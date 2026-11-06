# Tester Event Village sur votre PC

Ce guide vous permet de tester toute la billetterie à la main, sur votre PC Windows, avec le projet Supabase **event-village-dev**. Il se suit dans l'ordre. Comptez une heure pour la première installation.

Aucune valeur réelle n'est écrite ici. Partout où vous voyez `<quelque chose>`, remplacez tout le bloc, chevrons compris, par votre valeur. Ne collez jamais une clé, un secret ou un mot de passe dans un message, une capture d'écran ou un fichier du dépôt.

**Le risque à connaître avant tout :** sans la ligne `EV_INTEGRATIONS=fake` dans `.env.local`, `npm run dev` et `npm run cron:local` envoient de **vrais SMS**, payés par vous, et parlent au **vrai SamirPay**. Avant chaque séance, vérifiez la bannière décrite en section 6.

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

Une migration modifie la structure de la base. Celles du lot 8 sont au nombre de six.

Votre **référence de projet** est la suite de lettres au début de l'adresse Supabase : `https://<référence>.supabase.co`. Elle figure aussi dans **Project Settings > General**.

1. Connectez l'outil à votre compte. Le navigateur s'ouvre.

   ```powershell
   npx supabase@2.122.0 login
   ```

2. Reliez le dossier au projet. Le mot de passe de la base peut être demandé. L'outil peut encore afficher l'ancien nom `event-village-prod` : c'est le même projet, seule la référence compte.

   ```powershell
   npx supabase@2.122.0 link --project-ref <référence>
   ```

3. Comparez l'historique. Les colonnes Local et Remote doivent être identiques jusqu'à `20261105000007`. Seules les six lignes `20261106…` n'ont rien dans la colonne Remote.

   ```powershell
   npx supabase@2.122.0 migration list
   ```

4. Demandez la liste de ce qui serait appliqué, sans rien appliquer :

   ```powershell
   npx supabase@2.122.0 db push --dry-run
   ```

   La liste doit contenir **exactement** ces six fichiers, dans cet ordre :

   ```text
   20261106000001_lot8_canaux.sql
   20261106000002_lot8_essai.sql
   20261106000003_lot8_paiement.sql
   20261106000004_lot8_commissions.sql
   20261106000005_lot8_scan.sql
   20261106000006_lot8_profil.sql
   ```

   **Si la liste contient autre chose ou s'il manque un fichier : arrêtez-vous.** N'ajoutez pas `--include-all` et ne lancez pas `supabase migration repair`. Demandez d'abord une vérification : l'historique du projet ne correspond plus au dépôt.

5. Dans le tableau de bord Supabase, ouvrez **SQL Editor** et lancez ce contrôle. La première migration réécrit les catégories masquées. Une ancienne catégorie qui ne respecte pas les règles actuelles l'arrêterait.

   ```sql
   -- attendu : 0 et 0
   select count(*) filter (where max_per_order not between 1 and 50) as maximum_hors_regle,
          count(*) filter (where price <> trunc(price)) as prix_decimal
     from public.ticket_categories
    where not is_visible;
   ```

   Un autre résultat que 0 et 0 : arrêtez-vous et corrigez d'abord ces catégories.

6. Appliquez. Confirmez par `y` si l'outil le demande.

   ```powershell
   npx supabase@2.122.0 db push
   ```

7. Contrôlez dans **SQL Editor**, une requête à la fois :

   ```sql
   -- attendu : 6 lignes, de 20261106000001 à 20261106000006
   select version from supabase_migrations.schema_migrations where version like '20261106%' order by version;

   -- attendu avant seed:dev : 0 et 0 ; aucune catégorie n'a changé de comportement
   select count(*) filter (where sale_online <> is_visible) as ecarts_en_ligne,
          count(*) filter (where not sale_counter) as hors_guichet
     from public.ticket_categories;
   ```

8. Ouvrez `supabase/hotfix/2026-10-31-lot1a/03-verification.sql`, collez tout son contenu dans **SQL Editor** et lancez-le. Les 20 lignes doivent afficher `OK`. Une ligne `ÉCHEC` : arrêtez-vous.

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
| `NEXT_PUBLIC_APP_URL` | Adresse de l'application | `http://localhost:3000`, ou l'adresse du tunnel (section 9) | Oui |
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

**Avant tout essai en réel, retirez ces lignes** et gardez un plafond bas, car chaque SMS vous est facturé. Par exemple, `SMS_GLOBAL_DAILY_CAP=30` limite la journée à 30 codes, et à 21 pour les rappels et les invitations. Ce plafond ne s'applique pas aux messages indispensables, comme la confirmation d'achat : il limite la dépense sans la supprimer.

---

## 5. Simulé ou réel

| | Simulé | Réel |
|---|---|---|
| SMS | Écrits dans une fenêtre, aucun envoi, gratuit | Vrais SMS, payés par vous |
| Paiement | Faux SamirPay local, aucun argent | Vrai SamirPay, avec les clés de `.env.local` |
| Remboursement, retrait | Faux versement | Vrai versement |
| Comment l'obtenir | Mode A avec `EV_INTEGRATIONS=fake`, ou mode B | Retirer `EV_INTEGRATIONS=fake`, puis `npm run dev` |

**Ce que le marquage protège.** Chaque paiement, remboursement et retrait créé en simulé est marqué en base, et cette marque ne peut plus être retirée. Un serveur réel refuse de verser une opération marquée, et un serveur d'essai refuse de traiter une opération réelle. Un retrait fait sur un solde issu de ventes simulées est marqué lui aussi.

**Ce qui reste bloqué après le retour en réel.** Les billets simulés restent affichés, mais leur remboursement et les retraits liés n'aboutiront jamais. Ils apparaissent avec le motif « opération créée en mode simulé : aucun versement ». C'est voulu. N'essayez pas de les débloquer.

**Pour passer de simulé à réel :**

1. Terminez ou refusez les paiements en attente.
2. Laissez `npm run cron:local` tourner encore quelques minutes, pour vider la file de notifications. Sinon, de vrais SMS partiraient vers les numéros fictifs de `seed:dev`, qui appartiennent peut-être à quelqu'un.
3. Vérifiez dans **SQL Editor**. Chaque requête doit répondre 0 :

   ```sql
   select count(*) as notifications_en_file from public.notification_outbox where status in ('PENDING', 'SENDING');
   select count(*) as paiements_en_attente from public.payments where simulated and status = 'PENDING';
   select count(*) as versements_en_cours from public.cashouts where simulated and status in ('A_ENVOYER', 'ENVOYE');
   ```

4. Arrêtez tout (section 12), retirez `EV_INTEGRATIONS=fake` et les quotas relevés, posez `SMS_GLOBAL_DAILY_CAP`, puis relancez.
5. La bannière de la section 6 ne doit **plus** s'afficher.

Pour revenir en simulé, remettez `EV_INTEGRATIONS=fake` et relancez. Vérifiez alors que la bannière est revenue.

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

Ces adresses ne reçoivent aucun email, et leurs numéros sont fictifs : ces comptes ne servent qu'en simulé.

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

### 8.9 Guichet

Toujours en contrôleur, onglet **Guichet** : **Ouvrir ma caisse**, puis vendez un billet « Sur place ». Il porte la mention « Sur place uniquement ». Terminez par **Clôturer ma caisse**, sans écart.

Résultat attendu : le serveur donne le total, et la clôture s'enregistre.

### 8.10 Annulation

Compte `partenaire`, page de « Essai du jour », bouton **Annuler l'événement**. Retapez le titre pour confirmer.

Résultat attendu : l'annulation s'affiche sur la page publique, les ventes s'arrêtent, et les SMS d'annulation s'écrivent dans la fenêtre 2.

### 8.11 Remboursement

Il part seul après l'annulation. Le versement s'affiche dans la fenêtre 1, et l'avancement sur la page de l'événement. `cron:local` le confirme en 5 minutes au plus.

Résultat attendu : `client1` voit son billet marqué remboursé et reçoit le SMS. Sur `/admin/finance`, les totaux correspondent et il n'y a rien à reprendre.

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
| Avis de paiement SamirPay (webhook) | Réel seulement | En simulé, le faux service l'envoie directement au PC. En réel, SamirPay appelle l'adresse du tunnel. Sans tunnel, `cron:local` rattrape le paiement en quelques minutes |

Limites d'un tunnel rapide : 200 requêtes en cours au plus, une adresse différente à chaque lancement, aucune garantie de disponibilité. En réel, un SMS qui contient cette adresse plus longue peut coûter deux SMS.

Remettez `NEXT_PUBLIC_APP_URL=http://localhost:3000` et retirez `EV_DEV_TUNNEL_URL` quand vous avez fini.

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
