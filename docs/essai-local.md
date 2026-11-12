# Tester Event Village sur votre PC

Ce guide vous permet de tester toute la billetterie à la main, sur votre PC Windows, avec le projet Supabase **event-village-dev**. Il se suit dans l'ordre. Comptez une heure pour la première installation.

Aucune valeur réelle n'est écrite ici. Partout où vous voyez `<quelque chose>`, remplacez tout le bloc, chevrons compris, par votre valeur. Ne collez jamais une clé, un secret ou un mot de passe dans un message, une capture d'écran ou un fichier du dépôt.

**Le risque à connaître avant tout :** sans la ligne `EV_INTEGRATIONS=fake` dans `.env.local`, `npm run dev` et `npm run cron:local` envoient de **vrais SMS**, payés par vous, et parlent au **vrai SamirPay**. Avant chaque séance, vérifiez la bannière décrite en section 6. Pour une séance en réel voulue, suivez la section 13, et elle seule.

---

## 1. À quoi sert ce guide

Il existe deux façons de lancer l'application en essai. Les deux ne sont pas interchangeables.

| | Mode A : développement | Mode B : aperçu de production |
|---|---|---|
| Quand le choisir | Presque toujours : parcours complet, scan à la caméra | Seulement pour l'installation sur le téléphone et le billet hors ligne |
| Lancement | `npm run dev` | `npm run essai:build`, puis `npm run essai:start` |
| Où lire les codes SMS | Fenêtre de l'application | Fenêtre du faux SamirPay |
| Où valider un paiement | Page `/dev/paiements`, sur le PC ou le téléphone | `http://127.0.0.1:4010/`, sur le PC seulement |
| Installation et hors ligne | Non | Oui |
| Caméra du téléphone, par le tunnel | Oui | Oui |

Ce guide concerne uniquement event-village-dev. Il ne s'applique jamais à un projet de production : le serveur y refuse le mode simulé. Les tests automatiques, eux, ne touchent jamais à event-village-dev.

Le mot **fenêtre** désigne ici une fenêtre PowerShell. Vous en garderez trois ouvertes, quatre avec le téléphone. Dans chacune, placez-vous d'abord dans le dossier du projet :

```powershell
cd $HOME\Documents\event-village
```

---

## 2. Pré-requis

1. **Node.js.** La commande `node -v` doit afficher une version. La version de référence est la 22, celle des contrôles automatiques. Une version plus récente fonctionne sur ce PC ; en cas d'erreur inexpliquée, revenez à la 22.

2. **Les dépendances.** À faire une fois, puis à chaque fois que `package-lock.json` change. Arrêtez d'abord l'application si elle tourne.

   ```powershell
   npm ci
   ```

   **N'utilisez jamais `npm install`** : avec npm 11, il retire des lignes de `package-lock.json`, et la vérification automatique refuse ensuite le fichier. Si cela arrive, restaurez-le par `git restore package-lock.json`, puis relancez `npm ci`.

3. **L'outil Supabase.** Rien à installer : il se lance par `npx`, à la version exacte des contrôles automatiques. Essayez :

   ```powershell
   npx supabase@2.122.0 --version
   ```

4. **cloudflared**, seulement pour les essais au téléphone (section 9). Téléchargez [cloudflared-windows-amd64.exe](https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe), renommez-le `cloudflared.exe` et placez-le dans le dossier `Documents`. Si `winget` existe sur votre PC, `winget install --id Cloudflare.cloudflared` convient aussi : vous écrirez alors `cloudflared` au lieu de `.\cloudflared.exe`.

5. **La mémoire.** Avec 8 Go, fermez ce qui peut l'être : onglets du navigateur, éditeur si possible. Ne gardez qu'un onglet ouvert sur l'application. Ne lancez jamais `essai:build` pendant que `npm run dev` tourne.

---

## 3. Appliquer les migrations sur event-village-dev

Une migration modifie la structure de la base. Celles du lot 9 bis (`20261109…`) sont déjà appliquées sur event-village-dev. Il reste les **onze du lot 9 ter** (`20261110…`). Ne les appliquez qu'une fois la vérification automatique du lot annoncée verte dans `docs/lot9ter-rapport.md` : ce projet ne doit pas prendre d'avance sur le code livré. Seule exception, sur décision du chef de projet : la migration 1, de sécurité, peut passer seule et en premier (encadré plus bas).

Si l'étape 3 montre encore des lignes `20261109…` sans rien dans la colonne Remote, le lot 9 bis n'est pas appliqué sur ce projet : arrêtez-vous et demandez la procédure du lot 9 bis (`docs/deploiement-projet-neuf.md`, section 3 quinquies).

Votre **référence de projet** est la suite de lettres au début de l'adresse Supabase, juste avant `.supabase.co`. Elle figure aussi dans **Project Settings > General**.

1. Connectez l'outil à votre compte. Le navigateur s'ouvre.

   ```powershell
   npx supabase@2.122.0 login
   ```

2. Reliez le dossier au projet. Remplacez `VOTRE_REFERENCE` par la référence, **sans rien ajouter autour** : ni chevrons, ni guillemets. PowerShell refuse `<` et `>` dans une commande. Le mot de passe de la base peut être demandé. L'outil peut encore afficher l'ancien nom `event-village-prod` : c'est le même projet, seule la référence compte.

   ```powershell
   npx supabase@2.122.0 link --project-ref VOTRE_REFERENCE
   ```

3. Comparez l'historique. Les colonnes Local et Remote doivent être identiques jusqu'à `20261109000012`. Seules les onze lignes `20261110…` n'ont rien dans la colonne Remote (dix si la migration 1 est déjà passée).

   ```powershell
   npx supabase@2.122.0 migration list --linked
   ```

4. Demandez la liste de ce qui serait appliqué, sans rien appliquer :

   ```powershell
   npx supabase@2.122.0 db push --linked --dry-run
   ```

   La liste doit contenir **exactement** ces onze fichiers, dans cet ordre (sans le premier si la migration 1 est déjà passée) :

   ```text
   20261110000001_lot9ter_rls.sql
   20261110000002_lot9ter_reglages.sql
   20261110000003_lot9ter_transfert_statut.sql
   20261110000004_lot9ter_registre.sql
   20261110000005_lot9ter_argent.sql
   20261110000006_lot9ter_equipe_messages.sql
   20261110000007_lot9ter_evenements.sql
   20261110000008_lot9ter_invites.sql
   20261110000009_lot9ter_zones.sql
   20261110000010_lot9ter_pilotage.sql
   20261110000011_lot9ter_stock.sql
   ```

   **Si la liste contient autre chose ou s'il manque un fichier : arrêtez-vous.** N'ajoutez pas `--include-all` et ne lancez pas `supabase migration repair`. Demandez d'abord une vérification : l'historique du projet ne correspond plus au dépôt.

5. **Avant d'appliquer**, ouvrez **SQL Editor** dans le tableau de bord Supabase et lancez les contrôles « avant » de `docs/deploiement-projet-neuf.md`, section 3 sexies (« Contrôles avant d'appliquer », point 3), un à la fois. Ils ne modifient rien. Gardez leurs résultats : ils vont au rapport du lot. Le contrôle 9 demande l'identifiant d'un événement publié et celui de son propriétaire : prenez « Concert d'essai à Dakar » et le compte `partenaire`, lus dans le tableau de bord Supabase (**Table Editor**, tables `events` et `partners`).

6. Appliquez. Confirmez par `y` si l'outil le demande. Des avis « … does not exist, skipping » peuvent s'afficher : ils sont normaux. Aucune ligne `NOTICE` n'est à recopier pour ce lot.

   ```powershell
   npx supabase@2.122.0 db push --linked
   ```

7. Contrôlez dans **SQL Editor** : les contrôles « après » de `docs/deploiement-projet-neuf.md`, section 3 sexies, une requête à la fois. Au minimum :

   ```sql
   -- attendu : 11 lignes, de 20261110000001 à 20261110000011
   select version from supabase_migrations.schema_migrations where version like '20261110%' order by version;

   -- attendu : 0 ligne (plus aucune écriture possible par l'API REST)
   select 'politique' as genre, tablename as objet, policyname || ' (' || cmd || ')' as detail
     from pg_policies where schemaname = 'public' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
   union all
   select 'droit', c.relname, r.rol || ' : ' || k.priv
     from pg_class c cross join (values ('anon'), ('authenticated')) r(rol)
     cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) k(priv)
    where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and case when k.priv in ('INSERT', 'UPDATE') then has_any_column_privilege(r.rol, c.oid, k.priv)
               else has_table_privilege(r.rol, c.oid, k.priv) end
   order by 1, 2, 3;

   -- attendu : 2 lignes, {"value": 10} et {"value": 5}
   select key, value from public.platform_settings where key like 'access.refusal_alert_%' order by key;

   -- attendu : vrai
   select 'ADMITTED' = any (enum_range(null::public.ticket_transfer_status)::text[]);

   -- attendu : 17
   select count(*) from public.event_status_transitions;

   -- attendu : au moins 6, les comptes créés par seed:dev
   select count(*) as comptes_de_demonstration from public.users where demo_account;
   ```

8. Ouvrez `supabase/hotfix/2026-10-31-lot1a/03-verification.sql`, collez tout son contenu dans **SQL Editor** et lancez-le. Chaque ligne doit afficher `OK`. Une ligne `ÉCHEC` : arrêtez-vous.

9. Toujours en simulé, prouvez que la fiche partenaire est protégée (essai 80 du cahier de recette) :

   ```powershell
   npm run essai:fiche-partenaire
   ```

   L'outil lit `.env.local` (clé publique seulement, jamais la clé serveur), se connecte au compte `partenaire` de `seed:dev`, tente de modifier lui-même le statut de sa fiche, à sa valeur actuelle, puis relit la fiche. Il n'affiche aucune clé, aucun mot de passe, aucun jeton. Première ligne : `[fiche-partenaire] projet <référence> : connexion du compte partenaire@essai.eventvillage.invalid avec la clé publique seulement.`

   | Ligne affichée | Code de sortie | Sens |
   |---|---|---|
   | `[fiche-partenaire] Protégé : la fiche partenaire refuse toute modification directe de son statut (statut VALIDE inchangé).` | 0 | Attendu : la fiche ne se modifie que par l'écran |
   | `[fiche-partenaire] NON PROTÉGÉ : la fiche partenaire a accepté une modification directe de son statut. Arrêtez l'essai et prévenez l'équipe technique : la migration 20261110000001_lot9ter_rls n'est pas appliquée sur ce projet.` | 1 | Arrêtez-vous : la migration 1 manque |
   | `[fiche-partenaire] contrôle impossible : …` | 2 | Une variable manque dans `.env.local`, l'adresse est refusée, ou le compte n'existe pas (« lancez d'abord npm run seed:dev sur ce projet. ») |

   Le compte de l'essai est une partenaire validée : la protection ne dépend pas de l'état de la fiche, et la vérification automatique la prouve aussi pour une fiche en attente, refusée ou suspendue. Un mot de passe `EV_DEV_SEED_PASSWORD` qui contient `#` doit être entre guillemets dans `.env.local`.

10. Redémarrez ce qui tournait (section 6). Le code du lot 9 ter ne fonctionne pas sans ces migrations, et event-village-dev ne doit plus tourner qu'avec lui ou plus récent.

**La migration 1 seule, en premier (seulement si le chef de projet le décide).** Elle ferme les écritures directes dans la base et ne dépend d'aucune autre ; le code du lot 9 bis continue de fonctionner. Pour l'appliquer seule, il faut un second dossier du projet placé sur le commit où elle est la seule migration du lot :

```powershell
git worktree add ..\event-village-m01 bcb1d3da
cd ..\event-village-m01
npx supabase@2.122.0 link --project-ref VOTRE_REFERENCE
npx supabase@2.122.0 db push --linked --dry-run
```

Le `--dry-run` doit lister **un seul** fichier, `20261110000001_lot9ter_rls.sql`. Sinon, arrêtez-vous. Lancez alors le contrôle « 1 » d'avant (`docs/deploiement-projet-neuf.md`, section 3 sexies), puis `npx supabase@2.122.0 db push --linked`, puis le contrôle « 1 » d'après (0 ligne). Revenez dans le dossier du projet (`cd $HOME\Documents\event-village`), lancez `npm run essai:fiche-partenaire` (étape 9) et retirez le second dossier : `git worktree remove ..\event-village-m01`. Les dix autres migrations suivront par les étapes 1 à 10 ci-dessus. N'appliquez jamais la migration à la main dans **SQL Editor**.

---

## 4. Remplir `.env.local`

Ce fichier contient vos clés. Il reste sur votre PC, git l'ignore, et `.env.example` sert de modèle.

**Trois règles :**

- Ouvrez-le avec `notepad .env.local` et enregistrez-le en UTF-8. N'écrivez jamais dedans avec `>` dans PowerShell : le fichier deviendrait illisible et les scripts le refuseraient.
- N'utilisez ni `$` ni `#` dans une valeur, même entre guillemets : la valeur serait coupée sans message.
- Après chaque changement, redémarrez tout ce qui tourne : le serveur garde les valeurs lues au démarrage.

**Pour fabriquer un secret**, en hexadécimal, lancez cette commande une fois par secret et copiez le résultat à la main. Ne régénérez pas un secret qui fonctionne déjà.

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Variables de base

| Variable | Rôle | Où la trouver | Obligatoire |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Adresse du projet | Supabase, **Project Settings > API** | Oui |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique | Même page | Oui |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé serveur, secrète | Même page | Oui |
| `NEXT_PUBLIC_APP_URL` | Adresse de l'application | `http://localhost:3000`, ou l'adresse du tunnel (section 9), seule admise en réel (section 13) | Oui |
| `SAMIRPAY_API_URL`, `SAMIRPAY_API_KEY`, `SAMIRPAY_SECRET_KEY` | Paiement réel | Votre compte SamirPay | Oui, même en simulé : le serveur refuse de démarrer sans elles, mais ne s'en sert pas |
| `MTARGET_USERNAME`, `MTARGET_PASSWORD` | SMS réels | Votre compte MTarget | Oui, même en simulé, pour la même raison |
| `OTP_HASH_SECRET`, `TICKET_TOTP_MASTER_KEY`, `REGISSEUR_PIN_KEY` | Secrets de l'application | À fabriquer : trois valeurs différentes | Oui |
| `CRON_SECRET` | Secret des tâches planifiées | À fabriquer | Oui pour `cron:local` |
| `RESEND_API_KEY` | Envoi des emails | Votre compte Resend | Non. En mode A, l'email s'écrit dans la fenêtre sans partir. En mode B, il est coupé |

### Variables du mode d'essai

| Variable | Rôle | Valeur | Obligatoire |
|---|---|---|---|
| `EV_INTEGRATIONS` | Active les faux SMS et le faux paiement | `fake` | Oui pour le mode A et pour `seed:dev` |
| `EV_DEV_FAKE_SERVICES_URL` | Adresse du faux SamirPay | `http://127.0.0.1:4010/samirpay` | Oui pour le mode A |
| `EV_DEV_PROJECT_REF` | Référence de projet attendue par `seed:dev` | Votre référence (section 3) | Oui pour `seed:dev` |
| `EV_DEV_SEED_PASSWORD` | Mot de passe des comptes de test | 14 caractères au moins, avec une minuscule, une majuscule, un chiffre et un signe comme `-` ou `!`. Choisissez-le vous-même | Oui pour `seed:dev` |
| `EV_DEV_TUNNEL_URL` | Adresse du tunnel déclarée | Identique à `NEXT_PUBLIC_APP_URL` pendant les essais au téléphone | Seulement avec le tunnel |
| `EV_DEV_FAKE_PORT` | Port du faux SamirPay | 4010 par défaut. À ne pas changer | Non |
| `EV_DEV_APP_PORT` | Port de l'application | 3000 par défaut. À ne pas changer : `npm run dev` écoute sur 3000 | Non |

N'écrivez jamais `EV_ESSAI_SIMULATION` : `essai:start` s'en charge seul.

### Limites utiles aux essais

Les quotas comptent aussi en simulé. Par défaut, un numéro ne reçoit que 3 codes en 15 minutes. Pour une séance de test, vous pouvez ajouter :

```text
SMS_OTP_PER_PHONE_15MIN=20
SMS_OTP_PER_PHONE_DAY=100
SMS_OTP_PER_IP_HOUR=100
SMS_OTP_PER_IP_DAY=300
VERIFY_OTP_PER_PHONE_15MIN=50
```

**Avant tout essai en réel, retirez ces lignes** et posez `SMS_GLOBAL_DAILY_CAP=50`, car chaque SMS vous est facturé (section 13). Ce plafond arrête les codes à 50 par jour, et les rappels et invitations de contrôleurs à 35, sur un même compteur. **Il ne limite pas les SMS indispensables**, comme la confirmation d'achat, l'annulation ou le remboursement : ceux-là ne sont bornés qu'à 30 par numéro et à 30 par compte qui les déclenche, chaque jour.

Depuis le lot 9 ter, `GUEST_LIST_SEARCH_PER_SCANNER_HOUR` (30 par défaut) limite les recherches d'un contrôleur dans la « Liste des invités », par heure. Laissez la valeur par défaut : l'essai de la section 8.17 vérifie justement le refus de la 31e recherche.

---

## 5. Simulé ou réel

| | Simulé | Réel |
|---|---|---|
| SMS | Écrits dans une fenêtre, aucun envoi, gratuit | Vrais SMS, payés par vous |
| Paiement | Faux SamirPay local, aucun argent | Vrai SamirPay, avec les clés de `.env.local` |
| Remboursement, retrait | Faux versement | Vrai versement |
| Comment l'obtenir | Mode A avec `EV_INTEGRATIONS=fake`, ou mode B | Section 13 : contrôle, tunnel obligatoire, puis `npm run dev` sans `EV_INTEGRATIONS=fake` |

**Ce que le marquage protège.** Chaque paiement, remboursement et retrait créé en simulé est marqué en base, et cette marque ne peut plus être retirée. Un serveur réel refuse de verser une opération marquée, et un serveur d'essai refuse de traiter une opération réelle. Un retrait fait sur un solde issu de ventes simulées est marqué lui aussi.

**Ce qui reste bloqué après le retour en réel.** Les billets simulés restent affichés, mais leur remboursement et les retraits liés n'aboutiront jamais. Ils apparaissent avec le motif « opération créée en mode simulé : aucun versement ». C'est voulu. N'essayez pas de les débloquer.

**Pour passer de simulé à réel**, suivez la section 13, dans l'ordre. Elle commence par un contrôle automatique, `npm run essai:check-reel`, qui remplace les requêtes à copier des versions précédentes de ce guide. Ne retirez jamais `EV_INTEGRATIONS=fake` sans qu'il ait répondu « Rien ne partirait en réel ».

Pour revenir en simulé, suivez la fin de séance de la section 13 : le tunnel se coupe en premier.

---

## 6. Lancer l'application (mode A)

Ouvrez trois fenêtres, dans cet ordre.

**Fenêtre 1, le faux SamirPay :**

```powershell
npm run fake:samirpay
```

Attendu : une ligne `[faux-samirpay] prêt sur http://127.0.0.1:4010`, qui se termine par `aucun argent réel`.

**Fenêtre 2, l'application :**

```powershell
npm run dev
```

Attendu : `Ready`, puis, au démarrage ou à l'ouverture de la première page, la bannière :

```text
[essai] Intégrations simulées : aucun SMS ni paiement réel.
```

**Pas de bannière : arrêtez tout de suite par Ctrl+C** et vérifiez `EV_INTEGRATIONS=fake` dans `.env.local`. Tant qu'elle est absente, l'application peut envoyer de vrais SMS.

Une ligne qui commence par `[réel]` à la place de la bannière veut dire que l'application tourne en réel : arrêtez-la par Ctrl+C, sauf si vous suivez la section 13.

**Fenêtre 3, les tâches planifiées :**

```powershell
npm run cron:local
```

Attendu : `8 tâches, appels vers http://localhost:3000 ; Ctrl+C pour arrêter`, puis, chaque minute, une ligne comme `ev_notifications_dispatch HTTP 200 …`. Le premier passage de chaque tâche peut être lent : l'application la prépare à sa première utilisation. Le même journal est écrit dans `.logs/cron-local.log`.

Ouvrez ensuite `http://localhost:3000` : l'accueil doit s'afficher.

| Vous voyez | Cause | Que faire |
|---|---|---|
| `HTTP 401` dans la fenêtre 3 | `CRON_SECRET` diffère entre la fenêtre 2 et la fenêtre 3 | Redémarrez `npm run dev` après tout changement de `.env.local` |
| `HTTP 503` dans la fenêtre 3 | `CRON_SECRET` absent du serveur | Ajoutez-le à `.env.local`, puis redémarrez `npm run dev` |
| `connexion refusée` dans la fenêtre 3 | L'application ne tourne pas | Lancez ou relancez la fenêtre 2 |
| `heap out of memory`, ou PC figé | Mémoire insuffisante | Arrêtez la fenêtre 2, fermez d'autres programmes, puis relancez |

---

## 7. Créer les comptes de test

Une seule fois suffit. `seed:dev` n'efface rien et peut être relancé sans risque : ce qui existe déjà reste tel quel, mot de passe compris.

Lancez-le dans une fenêtre PowerShell ordinaire. Il refuse de tourner s'il ne peut pas vous poser sa question.

```powershell
npm run seed:dev
```

Le script affiche le projet ciblé et le nombre de comptes réels trouvés, puis demande de retaper la référence du projet. Vérifiez que c'est bien event-village-dev avant de répondre.

Il refuse dans ces cas :

| Message | Que faire |
|---|---|
| `EV_DEV_PROJECT_REF absente` ou `diffère` | Corrigez cette variable (section 4) |
| `EV_INTEGRATIONS=fake requis` | Ajoutez la ligne à `.env.local` |
| `EV_DEV_SEED_PASSWORD absent ou trop faible` | Le message dit ce qui manque |
| `Schéma en retard` | Faites la section 3 |
| `comptes réels sur ce projet, 25 au plus` | Le projet a plus de 25 comptes qui ne viennent pas de ce script. Ne contournez pas ce refus. Le seuil est la constante `MAX_REAL_ACCOUNTS` de `scripts/dev/seed-dev.core.ts` : ne la changez qu'après avoir vérifié ces comptes |
| `Confirmation fausse` | Relancez et retapez la référence à l'identique |
| `Terminal interactif requis` | Lancez la commande dans une vraie fenêtre PowerShell |

### Comptes créés

Mot de passe : la valeur de `EV_DEV_SEED_PASSWORD`. Connectez-vous avec l'adresse email, dans le champ « Email ou téléphone ».

| Compte | Rôle | Nom | Arrive sur |
|---|---|---|---|
| `superadmin@essai.eventvillage.invalid` | Super-administrateur | Aïda Essai | `/admin` |
| `admin@essai.eventvillage.invalid` | Administrateur | Moussa Essai | `/admin` |
| `partenaire@essai.eventvillage.invalid` | Partenaire validé (Essai Événements) | Mariama Essai | `/partner` |
| `controleur@essai.eventvillage.invalid` | Contrôleur | Ibrahima Essai | `/controller/scanner` |
| `client1@essai.eventvillage.invalid` | Client | Fatou Essai | Accueil |
| `client2@essai.eventvillage.invalid` | Client | Lamine Essai | Accueil |

Ces adresses ne reçoivent aucun email, et leurs numéros sont fictifs : ces comptes ne servent qu'en simulé. Ce sont des **comptes de démonstration** : en réel, rien ne leur est envoyé, et la supervision des notifications marque leurs messages « Non envoyé : compte de démonstration ».

### Événements créés

Aucune vente n'est créée : c'est à vous de les faire.

| Événement | État | Billets |
|---|---|---|
| Concert d'essai à Dakar | Publié, dans 3 semaines | Pass général 5 000 F (partout), Tarif guichet 4 000 F (sur place), Carré invités 10 000 F (invitations) |
| Journée portes ouvertes d'essai | Publié et gratuit, dans 4 semaines | Entrée libre |
| Gala d'essai en attente | En attente de validation | Table gala 15 000 F |
| Atelier d'essai en brouillon | Brouillon | Participant 2 000 F |

---

## 8. Parcours complet

Gardez les trois fenêtres ouvertes. Les SMS, y compris les codes, s'écrivent dans la fenêtre 2 sous la forme `[essai] SMS simulé pour <numéro> : <texte>`. Une notification part au plus tard au passage suivant de `cron:local`, soit moins d'une minute.

Faites ce parcours le même jour, entre 8 h et 19 h : de 22 h à 8 h, heure de Dakar, les SMS de rappel ne partent pas. Les événements de `seed:dev` étant dans plusieurs semaines, le scanner n'y fonctionne pas encore : il s'ouvre 6 heures avant le début. Vous allez donc créer un événement du jour.

### 8.1 Créer un événement

Compte `partenaire`, page `/partner/events`, bouton **Créer un événement**.

1. **Informations** : titre « Essai du jour », une description, une image quelconque de votre PC comme affiche (sans elle, la soumission est refusée), date du jour, et heure de début **dans 3 h 20**. L'heure de Dakar est l'heure GMT. Remplissez aussi les champs que le formulaire signale comme obligatoires.
2. **Billets** : ajoutez une catégorie « Entrée », 1 000 F, cochée **Vendue en ligne** et **Vendue au guichet**. Ajoutez « Sur place », 2 000 F, avec **Vendue au guichet** seulement.
3. Enregistrez, puis soumettez l'événement.

Résultat attendu : l'événement est en attente de validation.

### 8.2 Valider et publier

Compte `superadmin`, page `/admin/events`. Ouvrez « Essai du jour », puis **Valider**. Revenez sur le compte `partenaire` et publiez l'événement, depuis sa page.

Résultat attendu : l'événement s'affiche sur l'accueil et dans Explorer. « Sur place » n'y apparaît pas.

Pour voir aussi un refus, refusez « Gala d'essai en attente » avec un motif : le partenaire le lit sur sa page.

### 8.3 Achat payant, paiement validé

Compte `client1`. Ouvrez « Essai du jour », choisissez 1 billet « Entrée ». Le total affiché est de 1 050 F, dont 50 F de frais. Touchez **Acheter**, choisissez Wave ou Orange Money, puis saisissez un numéro à 9 chiffres : aucun SMS ni débit ne part.

La page d'attente propose un lien vers le paiement. Suivez-le, ou ouvrez `http://localhost:3000/dev/paiements`, qui liste tous les paiements en attente. Vérifiez la mention « Paiement simulé : aucun argent réel », puis cliquez **Valider le paiement**.

Résultat attendu : le billet apparaît dans **Mes billets**, son QR change toutes les 20 secondes, et le SMS de confirmation s'écrit dans la fenêtre 2.

### 8.4 Paiement refusé

Même compte, même événement : achetez un autre billet, puis cliquez **Refuser le paiement**.

Résultat attendu : la page du paiement annonce l'échec et propose **Réessayer le paiement**. Aucun billet n'est créé. Si la page était fermée, `cron:local` constate l'échec en quelques minutes.

Un compte ne peut pas lancer un second paiement sur un événement tant que le premier est en attente : terminez toujours l'essai précédent.

### 8.5 Billet gratuit

Compte `client2`. Ouvrez « Journée portes ouvertes d'essai », prenez une « Entrée libre ».

Résultat attendu : le billet arrive tout de suite dans **Mes billets**, sans paiement.

### 8.6 Code reçu par SMS

Déconnectez-vous, ouvrez `/register` et créez un compte avec un numéro inventé de 9 chiffres qui commence par `70`.

Résultat attendu : le code à saisir s'affiche dans la fenêtre 2. Par défaut, un numéro reçoit 3 codes en 15 minutes au plus.

### 8.7 Rappels

Le rappel d'avant le début est créé 3 heures avant l'heure de début, et seulement pendant les 15 minutes qui suivent. Passé ce délai, il n'est jamais rattrapé. Avec un début dans 3 h 20, cette fenêtre s'ouvre environ 20 minutes après la création de l'événement.

`cron:local` s'en occupe seul, toutes les 5 minutes. Pour forcer un passage, dans une autre fenêtre :

```powershell
node scripts/dev/cron-local.mjs --once ev_reminders
node scripts/dev/cron-local.mjs --once ev_notifications_dispatch
```

Passez ces commandes directement par `node`. Dans PowerShell, `npm run cron:local -- --once …` ne fonctionne pas : le `--` se perd en route et le script refuse l'option. `npm.cmd run cron:local -- --once ev_reminders` fonctionne aussi.

Résultat attendu : `client1` reçoit le rappel dans sa cloche et le SMS s'écrit dans la fenêtre 2, une seule fois. Vous n'avez pas ouvert de notification push, donc le SMS part.

### 8.8 Scan

Compte `partenaire`, page `/partner/team` : dans **Gérer les affectations** d'Ibrahima Essai, ajoutez « Essai du jour » et autorisez les espèces.

Compte `controleur`, page `/controller/scanner` : choisissez « Essai du jour » et commencez le contrôle.

- Sur le PC : passez en **Saisie manuelle** et entrez le numéro du billet de `client1`, lu dans **Mes billets**.
- Au téléphone : scannez le QR à la caméra (section 9).

Résultat attendu : écran vert à la première entrée, « déjà utilisé » à la seconde.

### 8.8 bis Invitations

À faire avant l'annulation de la section 8.10 : une invitation se scanne comme un billet, et l'événement doit être encore ouvert. Terminez d'abord l'inscription commencée en 8.6.

Compte `partenaire`, page `/partner/events` : ouvrez « Essai du jour », onglet **Invitations**.

1. **Catégorie** : « Entrée ». **Billets par numéro** : 1.
2. **Numéros de téléphone** : un numéro par ligne, **Numéro 1**, **Numéro 2**, **Numéro 3** (bouton **Ajouter un numéro**), à 9 chiffres, sans indicatif. Laissez vides les champs **Nom de l’invité** (ils servent en 8.17) :
   - le numéro du compte créé en 8.6 ;
   - `70 000 90 06`, le numéro de `client2` ;
   - un numéro inventé de 9 chiffres qui commence par `70`, sans compte.
3. Touchez **Envoyer les invitations**, puis **Confirmer**.

Résultat attendu : le bandeau « Invitations envoyées », trois lignes dans **Historique des invitations**, numéros masqués, canal « Invitation » à 0 F, statut « Envoyée ». Le stock de la catégorie baisse de 3, l'onglet **Ventes** compte 3 dans la colonne **Invitations**. Au passage suivant de `cron:local`, trois SMS s'écrivent dans la fenêtre 2, avec un lien vers Mes billets et aucun code.

Ce que voit chaque invité :

| Numéro | Ce qui se passe |
|---|---|
| Compte de 8.6, numéro vérifié à l'inscription | Le billet est déjà dans **Mes billets** |
| `client2` : comptes de `seed:dev`, numéro jamais vérifié | **Mes billets**, onglet **Reçus** : bandeau « Un billet vous attend peut-être. Confirmez votre numéro pour le voir. » Touchez **Confirmer mon numéro**, le code s'écrit dans la fenêtre 2, puis **Accepter le billet** |
| Numéro sans compte | Dans une fenêtre de navigation privée, créez le compte sur `/register` avec ce numéro. **Mes billets**, onglet **Reçus** : l'expéditeur est « L'organisateur de l'événement ». Touchez **Accepter le billet** |

Compte `controleur`, **Saisie manuelle** : entrez le numéro d'un de ces billets, lu dans **Mes billets** de l'invité. Résultat attendu : écran vert.

Pour voir l'annulation, invitez un autre numéro inventé, sur le même onglet, puis **Annuler l'invitation** dans l'historique et confirmez. Résultat attendu : « Invitation annulée : la place revient au stock. », statut « Annulée » ; le numéro invité est prévenu par SMS (simulé : il apparaît dans la fenêtre des SMS). Un numéro ne reçoit que 3 invitations par jour : au-delà, l'envoi est refusé.

L'export (onglet **Clôture**, **Exporter les participants**) porte, depuis le lot 9 ter, les colonnes « Nom », « Catégorie », « Origine » (« En ligne », « Guichet », « Gratuit », « Invitation »), « Statut du billet », « Heure d’entrée », « Zone » et « Porte », et « Invitation en attente » à la place du nom tant que le billet n'est pas réclamé. Sur « Concert d'essai à Dakar », « Carré invités » s'affiche en premier, sous « Sans canal de vente ».

### 8.9 Guichet

D'abord, compte `partenaire` : page de « Essai du jour », onglet **Caisse**, **Générer le code PIN**. Notez ce code : il n'est affiché qu'une fois, et il est exigé à l'ouverture de chaque caisse.

Toujours en contrôleur, onglet **Guichet** : **Ouvrir ma caisse**, saisissez le code PIN, puis vendez un billet « Sur place ». Il porte la mention « Sur place uniquement ». Terminez par **Clôturer ma caisse**, sans écart.

Résultat attendu : le serveur donne le total, et la clôture s'enregistre.

### 8.10 Annulation

Compte `partenaire`, page de « Essai du jour », bouton **Annuler l'événement**. Retapez le titre pour confirmer.

Résultat attendu : l'annulation s'affiche sur la page publique, les ventes s'arrêtent, et les SMS d'annulation s'écrivent dans la fenêtre 2. Avant de confirmer, la fenêtre d'annulation donne le nombre et le montant des ventes au guichet de 8.9 : Event Village ne les rembourse jamais, c'est l'organisateur qui rend les espèces.

### 8.11 Remboursement

Il part seul après l'annulation. Le versement s'affiche dans la fenêtre 1, et l'avancement sur la page de l'événement. `cron:local` le confirme en 5 minutes au plus.

Résultat attendu : `client1` voit son billet marqué remboursé et reçoit le SMS. Sur `/admin/finance`, les totaux correspondent et il n'y a rien à reprendre.

### 8.12 Mes paiements

Compte `client1`, page `/profile`, **Mes paiements**.

Résultat attendu : une ligne par paiement, du plus récent au plus ancien, avec l'événement, la date, l'opérateur, le montant et un statut en français. Le paiement de 8.3 est « Remboursé », celui de 8.4 « Échoué » ou « Annulé ». Les cartes **Total payé** et **Total remboursé** portent sur tous les paiements, pas sur la page. Une ligne mène à la page de statut du paiement. Aucun identifiant technique ne s'affiche.

Compte `client2` : « Aucun paiement pour le moment », un billet gratuit n'étant pas un paiement. Chaque compte ne voit que les siens. La liste du mode d'essai ne montre que les paiements simulés : ils disparaissent de cette page quand vous repassez en réel.

### 8.13 Photo de profil

Compte `client1`, page `/profile`, **Choisir une photo** : une image JPEG, PNG ou WebP de 2 Mo au plus.

Résultat attendu : « Photo de profil enregistrée. », et la photo s'affiche sur la page et dans la navigation. Choisissez une deuxième photo : elle remplace la première. Dans Supabase, **Storage > avatars**, le dossier du compte ne contient qu'un seul fichier `.webp`.

Essais de refus : un fichier texte renommé en `.jpg` donne « Format non pris en charge », un fichier de plus de 2 Mo est refusé. Aucun des deux ne change la photo.

**Supprimer la photo**, puis confirmez. Résultat attendu : les initiales reviennent et le fichier disparaît du bucket.

### 8.14 Ville et Populaires

Accueil, `http://localhost:3000`, connecté avec `client1`.

**Populaires** : la section montre les événements qui ont vendu des billets depuis 7 jours, dont « Journée portes ouvertes d'essai » (billet de 8.5). Les invitations ne comptent pas, et un événement annulé n'y figure plus. Le classement est gardé 60 secondes : rechargez après une minute. Sans vente récente, la section est absente : c'est normal.

**Près de chez vous** : dans **Votre ville**, choisissez Dakar.

Résultat attendu : les prochains événements de Dakar s'affichent, sans que le navigateur demande votre position. Déconnectez-vous puis reconnectez-vous : la ville reste, elle est enregistrée dans le profil.

Dans une fenêtre de navigation privée, sans compte, choisissez une ville et rechargez : elle reste, mais seulement dans ce navigateur.

Page `/explore` : tapez « portes » dans la recherche, seul « Journée portes ouvertes d'essai » doit rester. Le filtre **Ville** propose les villes du catalogue, et **Toutes les villes** remet tout. Les événements de `seed:dev` étant tous à Dakar, publiez-en un dans une autre ville pour voir la liste se réduire.

### 8.15 Changement de numéro

À faire en dernier : le compte n'aura plus son numéro de `seed:dev`.

Compte `client2`, page `/profile`, **Changer de numéro**. Si vous vous êtes connecté il y a plus de 10 minutes, l'écran demande d'abord votre mot de passe, celui de `EV_DEV_SEED_PASSWORD`. Saisissez un numéro inventé de 9 chiffres qui commence par `70`, touchez **Recevoir le code**. Le code s'écrit dans la fenêtre 2, pour ce nouveau numéro. Saisissez-le, puis **Confirmer**.

Résultat attendu : le nouveau numéro s'affiche et les billets restent au compte. Au passage suivant de `cron:local`, le SMS « le numéro de votre compte a été modifié » s'écrit dans la fenêtre 2, adressé à l'**ancien** numéro. Une session ouverte sur un autre navigateur est révoquée : elle se ferme au plus tard quand son jeton expire, soit 1 h au plus. La connexion par adresse email continue de fonctionner.

C'est le seul essai qui vérifie sur le projet hébergé la révocation des autres sessions : faites-le au moins une fois.

### 8.16 Zones, portes, couleurs et consignes (lot 9 ter)

Ces essais se font sur un second événement du jour, pour ne pas dépendre de l'annulation de 8.10. Ce que voit le contrôleur est décrit dans `docs/guide-organisateur-entrees.md`, sections 3 et 11 à 14.

1. Compte `partenaire` : créez « Soirée zones » comme en 8.1 (début dans 3 h 20, **Capacité totale (jauge)** à 17), avec trois catégories vendues en ligne : « SIMPLE » 1 000 F, quantité 10 ; « VIP » 2 000 F, quantité 5 ; « VVIP » 3 000 F, quantité 2. Faites-le valider et publiez-le (8.2).
2. **Modifier**, étape **Billets** : sur « VIP », **Couleur au contrôle** « Or » et **Consigne d’entrée** « Remettre bracelet doré — orienter vers le carré VIP », puis **Enregistrer la catégorie** (« Catégorie enregistrée. ») ; sur « VVIP », « Violet ».
3. Page de pilotage, onglet **Équipe**, « Zones et portes » : **Configurer des zones**. Renommez la zone « Entrée générale », gardez les trois catégories cochées, nommez sa porte « Porte Nord » et **Ajouter une porte** « Porte Sud ». **Ajouter une zone** : « Carré VIP », type **Contrôle de zone**, catégories « VIP » et « VVIP », porte « Accès carré ». **Enregistrer les zones** : « Zones enregistrées. »
4. Page `/partner/team`, **Gérer les affectations** d'Ibrahima Essai : ajoutez « Soirée zones ». Revenez à l'onglet **Équipe** du pilotage : un bandeau « Contrôleur sans porte » s'affiche. Sur la ligne d'Ibrahima, **Porte** « Porte Nord — Entrée générale », activez **Peut changer de porte**, **Enregistrer** : « Porte de Ibrahima Essai : Porte Nord. »
5. Compte `client1` : achetez 1 « SIMPLE », validez le paiement (8.3) ; puis 1 « VIP », validez. Compte `client2` : achetez 1 « VVIP », validez.
6. Compte `controleur`, scanner, « Soirée zones » : l'écran dit « Votre porte : Porte Nord · Entrée générale (Entrée). Le compteur affichera les entrées de cette porte. » **Commencer le contrôle**, **Saisie manuelle**, numéro du billet VIP de `client1`, pièce conforme, validez.

   Résultat attendu : écran vert « Entrée validée », « VIP » en très grand sur une bande or, la consigne, « Zone : Entrée générale · Porte Nord », le nom de Fatou Essai. Validez aussi le billet SIMPLE de `client1`. Puis, de nouveau, le billet VIP : « Entrée impossible : Billet déjà utilisé », sans bouton de validation.
7. La suite se fait **au téléphone, à la caméra** (section 9) : à une porte de contrôle de zone, la saisie manuelle ne valide rien et n'affiche qu'un aperçu « Entrée impossible : … ». **Changer de porte** (bouton de l'écran « Commencer le contrôle », qu'on retrouve par le bouton « Changer d’événement » en haut du scanner) : « Accès carré · Carré VIP (Contrôle de zone) », **Enregistrer cette porte**. Scannez :
   - le billet SIMPLE de `client1` : orange, « Accès refusé : billet SIMPLE » ;
   - le billet VVIP de `client2`, jamais passé à l'entrée : orange, « Pas encore entré », « Passez d’abord par : Entrée générale » ;
   - le billet VIP de `client1` : vert « Accès autorisé », « Zone : Carré VIP », « Entré à …, Porte Nord ».

   Puis passez à la porte « Porte Sud » : le billet VIP y affiche en rouge « Billet déjà utilisé » et « Déjà utilisé à …, Porte Nord ».

### 8.17 Liste des invités (lot 9 ter)

1. Compte `partenaire`, « Soirée zones », onglet **Invitations** : **Catégorie** « VIP », **Billets par numéro** 1, **Numéro 1** : un numéro inventé de 9 chiffres qui commence par `70`, sans compte ; **Nom de l’invité 1** : « Awa Diop ». **Envoyer les invitations** : la fenêtre « Confirmer l’envoi » montre « Awa Diop » dans la colonne « Invité ». Confirmez. Le SMS de la fenêtre 2 ne contient pas le nom.
2. Compte `controleur`, porte « Porte Nord » (**Changer de porte**), bouton **Liste des invités** : saisissez les 4 derniers chiffres du numéro, **Rechercher**.

   Résultat attendu : une carte « Awa Diop », « VIP », « 1 billet ». **Choisir**, cochez **J’ai vérifié la pièce d’identité**, **Valider l’entrée d’une personne** : écran vert, « Awa Diop », badge « Invitation ». Une nouvelle recherche du même numéro répond « Aucune invitation non utilisée pour ce numéro. »
3. Dans une fenêtre de navigation privée, créez le compte de ce numéro sur `/register`. **Mes billets**, onglet **Reçus** : « Entrée déjà validée à la porte le … à … » et **Ajouter à mes billets** ; le billet ajouté est utilisé.
4. Facultatif : enchaînez 30 recherches de plus dans l'heure. La 31e affiche « Trop de recherches dans l’heure : réessayez dans … min. »

### 8.18 Tableau de bord des entrées et alerte de refus (lot 9 ter)

1. Compte `partenaire`, « Soirée zones », onglet **Entrées** : les cartes « Liste des invités » (1), « Débit », « Contrôleurs actifs » (« 1 sur 1 » si Ibrahima a scanné dans les 10 dernières minutes, sinon « 0 sur 1 »), « Mis à jour à … », puis « Par zone », « Par porte », « Par catégorie », « Par origine », « Refus par motif » (« Mauvaise zone », « Pas encore entré »…) et « Validations par la liste des invités » avec « Awa Diop ».
2. Compte `superadmin`, page **Réglages de la plateforme** (`/admin/finance-settings`), section « Contrôle d’accès » : « Alerte de refus à une porte : nombre de refus » à 3, avec un motif.
3. Au téléphone (section 9), à la caméra, à la porte « Porte Sud » : présentez trois fois le billet VIP de `client1`, déjà utilisé, à 25 secondes d'intervalle au moins (une relecture plus rapprochée du même QR n'est pas envoyée).

   Résultat attendu : dans l'onglet **Entrées**, sans recharger, un bandeau rouge « Beaucoup de refus à Porte Sud » ; au passage suivant de `cron:local`, la cloche du compte `partenaire` reçoit « Refus en série à une porte ». Aucun SMS dans la fenêtre 2.
4. Remettez le réglage à 10, avec un motif.

### 8.19 Catégorie épuisée puis réouverte (lot 9 ter)

1. Compte `client1` : achetez le dernier « VVIP » de « Soirée zones » (2 en vente, 1 déjà vendu en 8.16). La fiche de l'événement affiche « Complet » pour « VVIP ». Sur l'accueil, la carte de « Soirée zones » porte « Dernières places » : chaque catégorie encore en vente a 10 places ou moins.
2. Compte `partenaire`, **Modifier**, étape **Billets** : passez la quantité de « VVIP » de 2 à 4, **Enregistrer la catégorie**. Résultat attendu : refus, « Les quantités mises en vente des catégories actives totaliseraient 19 places. Augmentez d’abord la capacité totale de l’événement (actuellement 17). »
3. Étape **Informations** : **Capacité totale (jauge)** à 19, enregistrez. Puis « VVIP » à 4, **Enregistrer la catégorie**.
4. Sur la fiche ouverte dans un autre onglet, **sans recharger** : « VVIP » affiche « Plus que 2 places ».

L'essai « une partenaire en attente tente de se valider elle-même » se fait par l'outil `npm run essai:fiche-partenaire` (section 3, étape 9).

La liste complète des essais, avec leur case OK ou anomalie, est dans `docs/recette-billetterie.md`.

---

## 9. Essais au téléphone

Le navigateur du téléphone n'ouvre la caméra et n'installe l'application que sur une adresse `https`. Cloudflare Tunnel crée une adresse temporaire qui mène à votre PC. Le téléphone a seulement besoin d'Internet.

**Deux contrôles, une seule fois :**

1. Dans Supabase, **Authentication > URL Configuration > Redirect URLs**, ajoutez `https://*.trycloudflare.com/**`.
2. Dans **SQL Editor**, lancez `select jobname from cron.job;`. Il ne doit y avoir **aucune** ligne commençant par `ev_`, car ces tâches feraient double emploi avec `cron:local`. Une erreur disant que `cron` n'existe pas est un bon résultat : rien n'est planifié. Si des lignes `ev_` existent, lancez `supabase/ops/unschedule-crons.sql` dans le même éditeur.

**Pour ouvrir le tunnel :**

1. Lancez l'application (section 6) et ouvrez une quatrième fenêtre :

   ```powershell
   cd $HOME\Documents
   .\cloudflared.exe tunnel --url http://localhost:3000
   ```

2. Copiez l'adresse affichée, de la forme `https://<nom>.trycloudflare.com`.
3. Dans `.env.local`, mettez cette adresse dans `NEXT_PUBLIC_APP_URL` **et** dans `EV_DEV_TUNNEL_URL`.
4. Redémarrez les fenêtres 1, 2 et 3. Laissez le tunnel ouvert : le fermer changerait l'adresse.
5. Ouvrez cette adresse sur le téléphone.

| Essai | Mode | Comment |
|---|---|---|
| Caméra du scanner | A ou B | Compte `controleur` sur le téléphone, QR affiché sur un autre écran. Autorisez la caméra |
| Paiement au téléphone | A | La page `/dev/paiements` s'ouvre par le tunnel |
| Installation | B | Suivez `docs/installer-application.md` |
| Billet hors ligne | B | Section 11 |
| Avis de paiement SamirPay (webhook) | Réel seulement | En simulé, le faux service l'envoie directement au PC. En réel, SamirPay appelle l'adresse du tunnel : sans adresse en https, le serveur réel refuse de démarrer (section 13). Si l'avis n'arrive pas, `cron:local` rattrape le paiement en 5 minutes au plus |

Limites d'un tunnel rapide : 200 requêtes en cours au plus, une adresse différente à chaque lancement, aucune garantie de disponibilité. En réel, un SMS qui contient cette adresse plus longue peut coûter deux SMS.

En simulé, remettez `NEXT_PUBLIC_APP_URL=http://localhost:3000` et retirez `EV_DEV_TUNNEL_URL` quand vous avez fini. En réel, le tunnel reste ouvert toute la séance : l'adresse `http://localhost:3000` y est refusée (section 13).

---

## 10. Quand l'adresse du tunnel change

Elle change à chaque nouveau lancement de `cloudflared`.

1. Mettez la nouvelle adresse dans `NEXT_PUBLIC_APP_URL` et `EV_DEV_TUNNEL_URL`.
2. Redémarrez l'application, `cron:local` et le faux SamirPay. Le serveur garde l'ancienne adresse tant qu'il n'est pas relancé, même s'il recharge le fichier. En mode B, un nouveau build n'est pas nécessaire.
3. Sur le téléphone, reconnectez-vous : la connexion est liée à l'adresse.
4. Supprimez l'application installée et réinstallez-la : elle est liée à l'ancienne adresse.
5. Retéléchargez les billets hors ligne en ouvrant **Mes billets** avec du réseau. Limite : 12 téléchargements par billet et par heure.
6. Les liens déjà envoyés, comme les invitations de contrôleurs, ne marchent plus : refaites-les.
7. Un paiement en cours n'est pas perdu : `cron:local` le retrouve.

---

## 11. Mode B : installation et billet hors ligne

Ce mode construit l'application comme en production, avec le faux SamirPay. Aucun fichier n'est modifié : `essai:start` remplace au lancement les adresses et les clés SamirPay et MTarget par des valeurs factices. Vous n'avez rien à changer dans `.env.local`.

1. Arrêtez `npm run dev` (fenêtre 2). Laissez la fenêtre 1 ouverte, ou relancez `npm run fake:samirpay`.
2. Construisez. Cela prend plusieurs minutes et demande beaucoup de mémoire : fermez tout le reste. N'utilisez pas `npm run build` à la place : il lirait `EV_INTEGRATIONS=fake`, interdit hors développement.

   ```powershell
   npm run essai:build
   ```

3. Lancez :

   ```powershell
   npm run essai:start
   ```

   Attendu : `[essai-start] aperçu de production vers le faux service http://127.0.0.1:4010 : aucun SMS ni paiement réel.`, puis la bannière `[essai] Intégrations simulées`.

4. Relancez `npm run cron:local` si besoin, et le tunnel pour le téléphone (section 9).

**Différences avec le mode A :**

- Les SMS s'écrivent dans la **fenêtre 1**, sous la forme `[faux-samirpay] SMS pour <numéro> : <texte>`.
- Le paiement se valide sur `http://127.0.0.1:4010/`, **sur le PC seulement** : boutons **Valider** et **Refuser**. Depuis le téléphone, le lien de paiement ne s'ouvre pas, c'est normal. Revenez sur la page d'attente d'Event Village, validez sur le PC, et le téléphone se met à jour.
- `/dev/paiements` n'existe pas : page introuvable.

**Billet hors ligne, à faire avec le tunnel :**

1. Installez l'application en suivant `docs/installer-application.md`.
2. Connectez `client1`, ouvrez **Mes billets** avec du réseau et attendez que le billet soit enregistré.
3. Passez le téléphone en mode avion et touchez **Afficher mes billets hors ligne**.

Résultat attendu : le QR s'affiche et change toutes les 20 secondes.

**Le dossier `.next` est commun aux deux modes.** `npm run dev` le remplace. Pour revenir au mode B après le mode A, refaites toujours `npm run essai:build`.

---

## 12. Dépannage et arrêt

### Après chaque séance

1. **Coupez le tunnel d'abord** : Ctrl+C dans sa fenêtre. Tant qu'il est ouvert, son adresse est publique. Quiconque la connaît peut ouvrir `/dev/paiements` et valider un faux paiement.
2. Arrêtez `cron:local`, l'application et le faux SamirPay par Ctrl+C.
3. Remettez `NEXT_PUBLIC_APP_URL=http://localhost:3000` si vous aviez changé l'adresse.

Après une séance en réel, suivez plutôt la fin de séance de la section 13 : elle vérifie qu'aucune opération réelle n'est restée en cours.

Les comptes, événements et billets restent dans event-village-dev. Le faux SamirPay garde ses paiements dans `.logs/fake-samirpay.json`, et `.logs/cron-local.log` garde le journal des tâches. Git ignore ce dossier. Vous pouvez relancer `npm run seed:dev` à tout moment : il ne recrée que ce qui manque.

### Problèmes fréquents

| Vous voyez | Cause | Que faire |
|---|---|---|
| `l'exécution de scripts est désactivée` | PowerShell bloque `npm` | Écrivez `npm.cmd` à la place de `npm` |
| `Options admises : --list, ou --once <tâche>` | Le `--` s'est perdu dans PowerShell | Utilisez `node scripts/dev/cron-local.mjs --once <tâche>` |
| `Configuration serveur invalide` | Une variable manque | Le message la nomme : ajoutez-la à `.env.local` |
| `.env.local est encodé en UTF-16` | Fichier écrit avec `>` | Dans le Bloc-notes : **Enregistrer sous**, encodage UTF-8 |
| `NODE_ENV=test` ou `NODE_ENV=production` | Variable restée dans la fenêtre | Fermez la fenêtre et ouvrez-en une nouvelle |
| `faux service injoignable` | Fenêtre 1 fermée | Lancez `npm run fake:samirpay` |
| `build absent` | Le mode B n'a pas été construit | Lancez `npm run essai:build` |
| `écoute impossible sur 127.0.0.1:4010` | Un autre faux SamirPay tourne déjà | Fermez l'ancienne fenêtre |
| Paiement toujours en attente | Faux SamirPay arrêté, ou opération non validée | Vérifiez la fenêtre 1, puis `/dev/paiements` |
| Page introuvable sur `/dev/paiements` | Mode B, ou `EV_INTEGRATIONS=fake` absent | Revenez au mode A et redémarrez |
| Trop de demandes de code | Quota atteint | Attendez, ou relevez les quotas (section 4) |
| `NEXT_PUBLIC_APP_URL diffère du tunnel` | Une des deux variables n'est pas à jour | Mettez la même adresse dans les deux |
| Erreur 502 sur l'adresse du tunnel | Application arrêtée | Relancez-la. Sinon, relancez le tunnel avec `http://127.0.0.1:3000` |
| Avertissement `Cross origin` dans la fenêtre 2 | Accès par le tunnel en mode A | À ignorer |
| `[réel] Refus de démarrer : en réel, NEXT_PUBLIC_APP_URL doit commencer par https://…` | Mode réel sans adresse de tunnel | Ouvrez le tunnel (section 9), mettez son adresse dans `NEXT_PUBLIC_APP_URL` et `EV_DEV_TUNNEL_URL`, relancez. Si vous ne vouliez pas le réel, remettez `EV_INTEGRATIONS=fake` |
| `[check-reel] … point(s) à traiter avant le réel` | Il reste des messages, des paiements, des versements ou des billets d'essai | Traitez chaque ligne affichée, en simulé, puis relancez le contrôle (section 13) |
| `[check-reel] contrôle impossible : …` | Migrations du lot 9 bis absentes, variable manquante ou projet injoignable | Le message dit la cause. Fonction absente : section 3 |
| « Non envoyé : compte de démonstration » dans la supervision | Message adressé à un compte de `seed:dev`, en réel | Normal : en réel, utilisez vos propres comptes (section 13) |

---

## 13. Tout en réel depuis votre PC

Cette section fait tourner l'application comme en production, depuis votre PC, sur event-village-dev : vrais SMS (MTarget), vrais paiements (SamirPay), vrais emails (Resend) et vraies notifications push. **De l'argent réel est débité, et chaque SMS vous est facturé.** Suivez les étapes dans l'ordre, sans en sauter.

### 13.1 Ce qu'il faut

- **Un compte marchand SamirPay que vous contrôlez** : son adresse d'API et ses deux clés, à mettre dans `SAMIRPAY_API_URL`, `SAMIRPAY_API_KEY` et `SAMIRPAY_SECRET_KEY`. L'adresse ne doit être ni `127.0.0.1` ni `localhost`. Le solde de ce compte doit couvrir les remboursements de vos essais.
- **Les identifiants MTarget** : `MTARGET_USERNAME`, `MTARGET_PASSWORD`, et `MTARGET_SENDER` si votre compte a un nom d'expéditeur.
- **Une clé Resend** : `RESEND_API_KEY`. Tant que vous n'avez pas de domaine vérifié chez Resend, Resend n'envoie qu'à l'adresse email de votre compte Resend, et seulement depuis son adresse d'essai : mettez `NOTIFICATION_FROM_EMAIL=onboarding@resend.dev`. C'est une règle de Resend, à confirmer dans votre tableau de bord Resend. Cette adresse ne recevra des emails que lorsqu'elle sera **vérifiée** dans le profil d'un de vos comptes (13.4).
- **Les clés VAPID** pour le push : lancez `npx web-push generate-vapid-keys --json`, puis mettez la clé publique dans `VAPID_PUBLIC_KEY`, la clé privée dans `VAPID_PRIVATE_KEY`, et `VAPID_SUBJECT=mailto:<votre adresse>`. Les trois, ou aucune.
- **Le tunnel** (section 9) : **obligatoire en réel**. SamirPay prévient l'application d'un paiement réussi par l'adresse du tunnel. Sans adresse en https, le serveur réel refuse de démarrer.
- **Trois numéros de téléphone réels**, de personnes d'accord pour recevoir des SMS : un pour votre compte administrateur, un pour le compte partenaire, un pour le compte client. Plus un compte Wave et un compte Orange Money pour payer de petits montants.
- **La signature des avis SamirPay**, seulement si vous l'avez activée sur votre compte SamirPay : mettez le secret qu'il vous donne (il commence par `whsec_`) dans `SAMIRPAY_WEBHOOK_SECRET`. Il faut ce secret **des deux côtés, ou d'aucun**. S'il est dans `.env.local` alors que SamirPay ne signe pas, chaque avis est refusé, et vos paiements ne sont confirmés que par `cron:local`, en 5 minutes au plus. Activez donc la signature chez SamirPay d'abord, puis copiez le secret, puis relancez l'application.

### 13.2 Préparer, encore en simulé

Gardez `EV_INTEGRATIONS=fake` et les trois fenêtres de la section 6 ouvertes.

1. **Les événements d'essai à venir qui ont des billets** : annulez-les depuis leur page, compte `partenaire`, ou attendez leur fin. Laissez les remboursements simulés aboutir.
2. **Les paiements en attente** : validez-les ou refusez-les sur `/dev/paiements`.
3. **La file des messages** : laissez `cron:local` tourner quelques minutes pour la vider.
4. **Votre compte administrateur.** Compte `superadmin` (connexion par mot de passe, aucun SMS), page `/admin/users`, **Créer un Compte / Admin** : rôle Administrateur, votre nom, votre vrai numéro, un mot de passe à vous, sans email pour l'instant. Puis, sur sa ligne, **Permissions** : cochez tout et enregistrez.
5. **Les réglages.** Toujours avec `superadmin`, page **Réglages de la plateforme** (`/admin/finance-settings`) : mettez « Seuil d'alerte des SMS indispensables du jour » à une valeur basse, par exemple 20. Les administrateurs sont alors alertés dès 20 SMS indispensables dans la journée. Laissez « Prix minimum d'un billet payant (F CFA) » à 100. Notez chaque ancienne valeur : vous la remettrez en fin de séance.
6. **Le contrôle.** Dans une fenêtre :

   ```powershell
   npm run essai:check-reel
   echo $LASTEXITCODE
   ```

   Il ne fait que lire la base. Il liste ce qui ferait partir de vrais messages ou de l'argent vers des comptes de démonstration : notifications en file, paiements simulés en attente, versements simulés en cours, billets de démonstration sur des événements à venir. Chaque ligne dit quoi faire.

   | Code | Dernière ligne | Que faire |
   |---|---|---|
   | 0 | `[check-reel] Rien ne partirait en réel : vous pouvez passer en réel …` | Passez à 13.3 |
   | 1 | `[check-reel] <n> point(s) à traiter avant le réel : ne retirez pas EV_INTEGRATIONS=fake.` | Traitez chaque ligne en simulé, puis relancez le contrôle |
   | 2 | `[check-reel] contrôle impossible : …` | Le message dit la cause. Fonction absente : section 3 |

   Une ligne « Pour information : … événement(s) de démonstration encore en vente » ne bloque rien : en réel, les messages de ces événements restent retenus.

   **Ne passez en réel qu'avec le code 0.** Relancez ce contrôle avant chaque passage en réel.

Ces deux étapes avec `superadmin` sont le seul usage d'un compte de `seed:dev`, et elles se font en simulé. Pendant la séance réelle, n'utilisez aucun compte de `seed:dev`.

### 13.3 Passer en réel

1. Arrêtez les trois fenêtres par Ctrl+C. La fenêtre 1, le faux SamirPay, ne sert plus.
2. Ouvrez le tunnel (section 9, « Pour ouvrir le tunnel », étapes 1 et 2) et copiez son adresse `https://<nom>.trycloudflare.com`.
3. Ouvrez `.env.local` avec `notepad .env.local` :
   - supprimez la ligne `EV_INTEGRATIONS=fake` ;
   - supprimez les quotas relevés de la section 4 ;
   - ajoutez `SMS_GLOBAL_DAILY_CAP=50` ;
   - mettez les vraies clés de 13.1 ;
   - mettez l'adresse du tunnel dans `NEXT_PUBLIC_APP_URL` **et** dans `EV_DEV_TUNNEL_URL`.
4. Fenêtre 2 : `npm run dev`. Attendu, au démarrage ou à l'ouverture de la première page :

   ```text
   [réel] SMS, paiements et emails RÉELS : de l’argent réel sera débité.
   ```

   et **aucune** bannière `[essai]`.

   - `[réel] Refus de démarrer : en réel, NEXT_PUBLIC_APP_URL doit commencer par https://, sinon l’avis de paiement de SamirPay ne peut pas arriver. …` : le serveur s'est arrêté, car l'adresse n'est pas en https. Reprenez l'étape 3.
   - Ni la ligne `[réel]`, ni la bannière `[essai]` : arrêtez tout de suite par Ctrl+C. Le réglage est mélangé, par exemple SamirPay encore sur `127.0.0.1` alors que les SMS partiraient pour de vrai.
5. Fenêtre 3 : `npm run cron:local`. Il est **indispensable en réel** : il envoie les messages, confirme les paiements dont l'avis n'arrive pas et suit les remboursements.
6. Ouvrez l'adresse du tunnel, sur le PC ou sur le téléphone.

**Ce que fait `SMS_GLOBAL_DAILY_CAP=50`** :

| Messages | Limite par jour |
|---|---|
| Codes reçus par SMS : inscription, connexion, retrait… | 50 au plus, sur un compteur partagé avec la ligne suivante |
| Rappels et invitations de contrôleurs | arrêtés quand ce même compteur atteint 35 |
| SMS indispensables : confirmation d'achat, annulation, remboursement… | **aucune limite du jour**. Seulement 30 par numéro, et 30 par compte qui les déclenche. C'est pourquoi le seuil d'alerte est réglé bas en 13.2 |

### 13.4 Vos comptes

N'utilisez jamais les comptes de `seed:dev` en réel. Rien ne leur est envoyé : leurs messages apparaissent dans la supervision, `/admin/notifications`, avec « Non envoyé : compte de démonstration ».

- **Administrateur** : celui créé en 13.2. Connectez-vous avec son numéro et son mot de passe.
- **Partenaire** : inscrivez-vous sur `/partner/register` avec le deuxième numéro. Un vrai code arrive par SMS. Déposez les pièces demandées. Avec votre compte administrateur, ouvrez le dossier depuis le tableau de bord de l'administration et validez-le.
- **Client** : inscrivez-vous sur `/register` avec le troisième numéro. Un vrai code arrive par SMS. Dans le champ email, mettez l'adresse de votre compte Resend, puis ouvrez le lien reçu, valable 24 heures. Le profil passe de « Email non vérifié » à « Email vérifié ». Une adresse ne peut être vérifiée que par un seul compte.
- **Push** : sur le téléphone du client, page `/profile/notifications`, **Activer les notifications**, puis **Envoyer une notification d'essai**. Elle arrive dans la minute.

### 13.5 Les essais d'argent

Compte partenaire : créez un événement pour le lendemain, comme en 8.1, avec une catégorie « Entrée » à petit prix, par exemple 200 F CFA, vendue en ligne. Le prix doit rester au-dessus du « Prix minimum d'un billet payant » (100 F CFA). Faites-le valider par votre compte administrateur, puis publiez-le. Si un paiement ne se lance pas, avec « Le paiement n’a pas pu être lancé », le montant est peut-être sous le minimum du compte SamirPay : passez la catégorie à 500 F CFA et réessayez.

Faites les essais dans cet ordre, avec le compte client :

1. **Achat Wave.** 1 billet, Wave, le numéro du compte Wave. Validez le paiement dans l'application Wave. Attendu : le billet dans **Mes billets**, le SMS de confirmation, et l'email de confirmation si l'adresse est vérifiée.
2. **Achat Orange Money.** Même chose avec Orange Money.
3. **Paiement abandonné.** Lancez un achat et ne validez rien sur le téléphone. Après la durée de garde des places (10 minutes par défaut, réglage « Durée de garde des places pendant un paiement »), la page d'attente affiche « Places plus garanties » et propose **Annuler ce paiement**. Annulez. Attendu : rien n'est débité, la place revient en vente, et un nouvel achat redevient possible.
4. **Annulation avec remboursement réel.** Compte partenaire, page de l'événement, **Annuler l'événement**, retapez le titre. Attendu : les deux achats sont remboursés seuls, le client reçoit le SMS d'annulation puis celui du remboursement versé, et l'argent revient sur ses comptes Wave et Orange Money. L'avancement se lit dans l'onglet **Clôture** du pilotage. Les frais SamirPay de ces remboursements sont retenus sur le solde du partenaire, parce que c'est lui qui annule. Si le solde SamirPay ne suffit pas, le remboursement est bloqué : le client voit « Remboursement retardé, l’équipe Event Village s’en occupe. », et la ligne apparaît dans « Versements à reprendre », sur `/admin/finance`.
5. **Retrait, facultatif.** Il demande des recettes disponibles : un autre événement, non annulé, terminé depuis le « Délai après la fin de l’événement » (48 heures par défaut), avec au moins le « Montant minimum de retrait » (5 000 F CFA par défaut). À faire lors d'une séance suivante. Avant d'envoyer le code de retrait par SMS, l'écran montre le minimum, les frais et le montant que vous recevrez.

### 13.6 Ce qu'il faut relever

Pour chaque essai, notez :

| Relevé | Où le lire |
|---|---|
| L'avis de paiement de SamirPay est-il arrivé ? | Dans **SQL Editor** : `select first_received_at, result from public.payment_webhook_events order by first_received_at desc limit 5;`. `CONFIRMED` : reçu et accepté. `REJECTED_SIGNATURE` : signature refusée, voir 13.1. Aucune ligne pour ce paiement : l'avis n'est pas arrivé, et `cron:local` a confirmé le paiement |
| Le délai | L'heure de validation sur le téléphone, puis l'heure d'arrivée du billet dans **Mes billets** et celle du SMS |
| Les frais réellement prélevés par SamirPay | Le tableau de bord SamirPay, pour chaque paiement et chaque remboursement. Comparez avec « Frais agrégateur Wave » et « Frais agrégateur Orange Money » des Réglages de la plateforme |
| Ce que montre Event Village | `/admin/finance`, section « Frais SamirPay » : frais réels des versements, frais estimés, écart. Pour les achats, l'écran dit « Frais réels non fournis par SamirPay pour ce mode d’encaissement » : seul le tableau de bord SamirPay les donne. Chaque montant doit correspondre au tableau de bord SamirPay |
| Les messages | La supervision, `/admin/notifications` : chaque SMS, email et push « Envoyée ». Le nombre de SMS facturés, dans votre compte MTarget |

### 13.7 Fin de séance

1. **Coupez le tunnel en premier** : Ctrl+C dans sa fenêtre. Plus aucun visiteur ni aucun avis de SamirPay n'arrive.
2. Laissez l'application et `cron:local` tourner, et vérifiez dans **SQL Editor** qu'aucune opération réelle n'est en cours. Attendu : 0 et 0.

   ```sql
   select count(*) as paiements_reels_en_attente from public.payments where not simulated and status = 'PENDING';
   select count(*) as versements_reels_en_cours from public.cashouts where not simulated and status in ('A_ENVOYER', 'ENVOYE', 'INCERTAIN');
   ```

   Sinon, attendez quelques passages de `cron:local`, puis relancez les requêtes : une fois revenu en simulé, le serveur refuse de traiter une opération réelle. Un versement à l'issue incertaine ne repart jamais seul : traitez-le dans « Versements à reprendre », sur `/admin/finance`, ou notez-le pour la prochaine séance réelle.
3. Arrêtez `cron:local`, puis l'application, par Ctrl+C.
4. **Retour en simulé**, dans `.env.local` : remettez `EV_INTEGRATIONS=fake` et `NEXT_PUBLIC_APP_URL=http://localhost:3000`, supprimez `EV_DEV_TUNNEL_URL`. Les vraies clés peuvent rester : en simulé, elles ne servent pas.
5. Relancez les trois fenêtres de la section 6. La bannière `[essai]` doit revenir, sans ligne `[réel]`.
6. Avec `superadmin`, remettez les réglages notés en 13.2.
