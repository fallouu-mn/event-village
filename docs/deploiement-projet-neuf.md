# Déploiement — montage du futur projet de production depuis zéro

**Statut :** procédure préparée au lot 1A, **à ne pas exécuter maintenant**. Elle sera relue et complétée après les lots 1B à 5 (en particulier la vérification de signature des webhooks SamirPay, lot 2).

**Principe :** la production se fait sur un projet Supabase **neuf**. On n'y copie rien du projet de test : ni données, ni comptes, ni clés. Le schéma vient uniquement des migrations du dépôt.

---

## 1. Pré-requis

- Branche du dépôt validée (CI verte : `npm run verify`).
- Supabase CLI à la version figée dans `.github/workflows/verify.yml`.
- Accès administrateur au compte Supabase de l'organisation, aux comptes SamirPay, MTarget et Resend de production.
- Un poste de confiance pour l'opérateur. Les secrets ne transitent ni par le dépôt, ni par un chat, ni par une capture d'écran.

## 2. Créer le projet

1. Créer un nouveau projet Supabase dans l'organisation, région la plus proche de Dakar, mot de passe de base généré et conservé dans le gestionnaire de secrets.
2. Dans **Authentication > Providers** :
   - email : activé ; « Confirm email » : **activé** ;
   - inscription publique : activée (le trigger `handle_new_user` ne crée plus que des comptes CLIENT) ;
   - téléphone : selon le choix produit ; l'envoi passe par le hook SMS (étape 5).
3. Dans **Authentication > Rate limits** : conserver les valeurs par défaut de Supabase (la valeur relevée de `supabase/config.toml` ne concerne que l'instance locale de test).
4. Ne créer **aucune** fonction, table ni politique à la main dans l'éditeur SQL. Tout passe par les migrations (étape 3). Une fonction créée à la main échappe aux tests de privilèges (c'est ainsi qu'`exec_sql` est apparue sur le projet de test).

## 3. Appliquer le schéma depuis zéro

Sur un projet neuf, l'historique de migrations est vide : `db push` applique tout, dans l'ordre.

```bash
supabase link --project-ref <ref-du-projet-de-production>
supabase db push --dry-run     # relire la liste : toutes les migrations du dépôt, rien d'autre
supabase db push
```

Puis exécuter `supabase/hotfix/2026-10-31-lot1a/03-verification.sql` dans l'éditeur SQL : **toutes** les lignes doivent être `OK`. Sur un projet neuf, cette vérification doit passer sans appliquer `02-hotfix.sql` (la migration du lot 1A est déjà incluse).

## 4. Données de référence (sans données de test)

- `supabase/seed.sql` n'est **pas** joué par `db push`. Les données de référence nécessaires au fonctionnement sont créées par les migrations : `platform_settings` (dont `ticketing_fee_config`, migration `0012`) et `subscription_plans`.
- **Ne jamais exécuter** `npm run seed:test` ni `tests/seed/seed-test.ts` contre ce projet : ce seed crée des comptes de test avec un mot de passe connu. Le garde-fou `tests/helpers/env.ts` refuse de toute façon une URL non locale.
- Avant l'ouverture, vérifier et corriger les valeurs métier contradictoires relevées par l'audit (taux de parrainage `referral_config` de la migration `0011` contre CDC §95-§97, tarifs des packs) : traité dans un lot ultérieur, à valider avec le client.

## 5. Variables d'environnement de l'application

À saisir dans l'hébergeur (jamais dans un fichier versionné). `lib/env.ts` refuse de démarrer les routes serveur si une variable obligatoire manque et liste les absentes.

| Variable | Obligatoire | Source |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | oui | Projet de production > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | oui | idem (clé publique) |
| `SUPABASE_SERVICE_ROLE_KEY` | oui | idem (secret serveur) |
| `NEXT_PUBLIC_APP_URL` | oui | URL publique définitive (sert aux liens d'activation et aux URLs de retour de paiement) |
| `SAMIRPAY_API_URL` | oui | `https://app.samirpay.com/samirpays` (jamais l'URL sandbox) |
| `SAMIRPAY_API_KEY`, `SAMIRPAY_SECRET_KEY` | oui | compte SamirPay de **production**, clés nouvelles |
| `SAMIRPAY_WEBHOOK_SECRET` | requis au lot 2 | compte SamirPay de production |
| `MTARGET_USERNAME`, `MTARGET_PASSWORD`, `MTARGET_SENDER`, `MTARGET_SERVICE_ID` | oui pour l'envoi de SMS | compte MTarget, identifiants renouvelés |
| `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`, `SUPPORT_EMAIL` | oui pour l'envoi d'emails | compte Resend, clé nouvelle, domaine vérifié |
| `SUPABASE_AUTH_HOOK_SECRET` | oui | **nouveau** secret généré à l'étape 6 (jamais la valeur du projet de test, publiée) |
| `CRON_SECRET` | oui | secret aléatoire propre aux tâches planifiées |
| `OTP_HASH_SECRET` | oui | secret aléatoire dédié (`openssl rand -hex 32`), différent de toute autre clé ; le changer invalide seulement les codes OTP en cours (10 min) |
| `EV_INTEGRATIONS` | non | ne pas définir (valeur `fake` interdite en production) |

Règles :

- aucune clé du projet de test ou de l'ancien `.env.local` n'est réutilisée ;
- `SUPABASE_AUTH_HOOK_SECRET` sert aussi, à ce jour, de clé de dérivation des QR dynamiques et du sel des PIN régisseur (retiré au lot 4) : il doit être unique à la production.

## 6. Hook SMS de Supabase Auth

1. **Authentication > Hooks > Send SMS hook** : type HTTPS, URL `https://<domaine>/api/auth/sms-hook`.
2. Générer le secret dans ce même écran, le reporter dans `SUPABASE_AUTH_HOOK_SECRET` de l'application, redéployer.
3. Tester l'envoi d'un OTP vers un numéro de l'équipe.

## 7. Tâches planifiées

Configurer l'appel périodique de `/api/cron/moratoriums` et `/api/cron/ticket-transfers` avec l'en-tête `Authorization: Bearer <CRON_SECRET>`. La purge des réservations temporaires de stock (hold cart) n'a pas encore de route planifiée : constat de l'audit traité au lot 2.

## 8. Bootstrap du premier SUPERADMIN

Le rôle SUPERADMIN n'est **plus** attribué par l'inscription (l'ancien trigger le donnait à quiconque déclarait le téléphone 773780756, y compris en métadonnée). Procédure :

1. La personne désignée crée son compte par l'inscription normale de l'application (email et téléphone réels), puis vérifie son téléphone.
2. L'opérateur, sur son poste, avec les variables du projet de **production** chargées dans le shell :

   ```bash
   npx tsx scripts/bootstrap-superadmin.ts --phone +221XXXXXXXXX --operator "Prénom Nom de l'opérateur"
   ```

   Le script refuse si un SUPERADMIN existe déjà, attribue le rôle dans `user_roles`, met à jour le profil et journalise l'opération (`audit_logs`, action `SUPERADMIN_BOOTSTRAP`).
3. Les administrateurs suivants sont créés depuis l'administration (`/api/admin/users`), qui attribue désormais le rôle explicitement.
4. Vérifier : la personne se reconnecte et accède à `/admin` ; `03-verification.sql` reste entièrement `OK`.

## 9. Recette avant ouverture

- `03-verification.sql` : tout `OK`.
- `supabase/hotfix/2026-10-31-lot1a/04-smoke-test.md` contre le projet de production : résultats « attendu après ».
- Parcours manuels : inscription client avec OTP, inscription partenaire puis validation par l'administration, création d'un événement, achat d'un billet en paiement réel de faible montant, scan par un contrôleur.
- Surveillance : journaux de l'hébergeur et **Logs > API** de Supabase pendant les premiers jours.

## 10. Ce que cette procédure ne couvre pas encore

- vérification de signature des webhooks SamirPay et confirmation de transaction (lot 2) ;
- politiques partenaire / contrôleur et confiance du middleware dans les métadonnées du jeton (lot 1B) ;
- correction de l'enregistrement des codes OTP en base par les routes d'inscription (colonne `user_id` inexistante), indispensable avant un hébergement à plusieurs instances ;
- secrets de dérivation TOTP et PIN dédiés (lot 4).
