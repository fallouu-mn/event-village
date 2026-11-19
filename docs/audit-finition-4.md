# Contre-vérification de la finition 4 (messages)

Branche auditée : `origin/finition-4/messages` à `af401d0f6` (rapport du lot `docs/finition-4-rapport.md`), lue seulement.
Tests de l'audit : branche `finition-4/rouges` (partie de `af401d0f6`, **jamais fusionnée**), dossier `event-village-cvf4`.
Aucun appel distant, aucune migration appliquée, `.env.local` non lu, branche du lot non modifiée, aucun correctif écrit.

## Verdict

**3 trous, aucun critique ni élevé ; 3 moyens.** L'argent, les données des acheteurs, la bienvenue et le merci tiennent. Les trous
touchent la nuit (deux avis aux porteurs reportés à 07:00 sans revérification de l'événement) et la limite de SMS par numéro
(les SMS facultatifs des ventes la consomment et font perdre un SMS indispensable). Un risque de fusion avec le lot 10b est
signalé à part (R1) : il efface une partie de la finition 4 quel que soit l'ordre de fusion.

| Point | Résultat | Trous | Garde-fous verts |
|---|---|---|---|
| 1. Argent | **Tenu** | — | G4 (+ comparaison des recopies, § 1) |
| 2. Nuit | **Trous** | T1, T2 | G1, G2 |
| 3. SMS | **Trou** | T3 | G3 (+ quotas en amont, § 3) |
| 4. Données | **Tenu** | — | G3 (nom masqué), G5 |
| 5. Bienvenue et merci | **Tenu** | — | G1, G6, G7 |

Run de preuve : **468** (`8753a685f`, run rapide sur les 4 suites de l'audit) : T1, T2 et T3 rouges, chacun sur le
comportement visé ; G1 à G7 verts. Sortie brute en § 7.

## 1. Argent — tenu

**Recopies.** `payment_confirm` (`20261125000003_f4_ventes.sql:146`) et `notif_cashouts_notify` (`…:568`), extraites et
comparées à leur dernière définition de main (`20261111000005_lot9quater_argent.sql`, `20261123000106_l11a_annulation.sql`).
Seules les mises en file d'avis changent. Aucune ligne `UPDATE`, aucune insertion dans `cashouts`, `finance_ledger` ou
`admin_signals` (`CASHOUT_UNCERTAIN`, `REFUND_TO_RETRY`), aucun montant ni aucun état n'est touché. Sortie brute :

```
$ diff payment_confirm (20261111000005 → 20261125000003)
181,187c181,186
<             PERFORM public.notif_enqueue(jsonb_build_object(
<                 'type', 'NEW_ORDER', 'key', 'NEW_ORDER:' || p_payment_id::text,
<                 'user_id', v_owner, 'event_id', v_event,
<                 'data', v_data || jsonb_build_object(
<                     'payment_id', p_payment_id,
<                     'ticket_count', COALESCE(array_length(v_ticket_ids, 1), 0),
<                     'total', COALESCE(v_pay.facial_amount, v_pay.amount - COALESCE(v_pay.service_fee, 0)))));
---
>             -- Finition 4 (point 2) : cloche groupée toutes les 15 minutes, SMS groupé au plus toutes les 30 minutes
>             PERFORM public.notif_sale_recorded(jsonb_build_object(
>                 'owner_id', v_owner, 'event_id', v_event,
>                 'payment_id', p_payment_id,
>                 'ticket_count', COALESCE(array_length(v_ticket_ids, 1), 0),
>                 'total', COALESCE(v_pay.facial_amount, v_pay.amount - COALESCE(v_pay.service_fee, 0))));

$ diff notif_cashouts_notify (20261123000106 → 20261125000003) : 54 lignes changées, dont celles qui citent un montant ou une écriture :
<             'data', v_event_data || jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount)
>                 'data', v_event_data || jsonb_strip_nulls(jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount,
>             SELECT COALESCE(NULLIF(r.facial_part, 0), NEW.amount) INTO v_refund_facial FROM public.refunds r WHERE r.id = NEW.refund_id;
>                 'add', jsonb_build_object('ticket_count', 1, 'amount', COALESCE(v_refund_facial, NEW.amount))));
<                     'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount)
>                     'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'not_paid', v_not_paid)
```

**Exceptions dans la transaction d'argent.** Le nouveau code appelé dans `payment_confirm` et dans le trigger des versements
(`notif_sale_recorded`, `notif_enqueue_grouped`) ne lève que sur un type, une série ou un destinataire absents. Tous sont
construits à partir de valeurs non nulles à cet endroit : la confirmation ne peut pas échouer à cause d'un avis.

**Auteur d'un remboursement.** Il est lu dans `audit_logs` (`TICKET_REFUND_REQUESTED`). La seule fonction qui crée un cashout
`TICKET_REFUND` est `ticket_refund_request` (`20261116000001_f2a_fiche_suspendue.sql`), qui écrit ce journal (ligne 1838)
avant le cashout (ligne 1947). L'attribution ne peut donc pas lire un journal absent.

**G4, vert.** Deux confirmations simultanées du même paiement (webhook et relève, deux transactions), puis un rejeu RPC et un
rejeu du webhook. Résultat : `CONFIRMED` puis `ALREADY_CONFIRMED`, deux billets (pas quatre), grand livre inchangé par les
rejeux, un avis d'achat par canal, une seule commande ajoutée à la cloche groupée, deux billets comptés dans le SMS groupé.

## 2. Nuit — deux trous

Ce qui tient :
- **Urgent jamais reporté (G2).** Seuls les types `night_policy = DEFER` sont reportés (`20261125000002_f4_nuit.sql:257`).
  Un avis indispensable à 02:00 part tout de suite.
- **Reporté, pas perdu.** La décision `DEFER` laisse la ligne `PENDING`, sans tentative ni budget consommé, et la repousse à
  la fin de la plage.
- **Plage = réglage.** Les bornes sont lues à chaque réservation (`notif.sms_quiet_start` / `_end`), y compris pour une plage
  qui passe minuit (`notif_in_quiet_hours`, `notif_quiet_end_at`). Aucune plage en dur dans `lib/` ou `app/`.
- **Préférence coupée.** Elle est relue à la réservation de 07:00 pour toute la famille facultative.
- **Merci d'un événement annulé (G1).** Il est annulé à l'envoi.

### T1 — avis « suspendu » envoyé à 07:00 après l'annulation de l'événement (moyenne)

`EVENT_SUSPENDED_HOLDER` est de la famille `OPTIONAL`, donc `DEFER` (`20261125000001_f4_registre.sql:114`). Son SMS et son
push préparés la nuit sont reportés à 07:00. À 07:00, `notification_outbox_claim` ne revérifie l'état de l'événement que pour
les rappels, `EVENT_CHANGED`, `CATEGORY_SOLD_OUT` et `ENTRY_THANKS` (`20261125000002_f4_nuit.sql:203-250`). De son côté,
`notif_cancel_on_status` (`20261109000009_lot9bis_messages.sql:941-963`) n'annule pas ces avis quand l'événement change
d'état.

Scénario :
1. L'administration suspend une soirée à 02:00.
2. Elle l'annule à 04:00 : le porteur reçoit l'annulation (urgente) tout de suite.
3. À 07:00, il reçoit par SMS et par push « … est suspendu pour le moment. Vos billets restent valables ».

Avant la finition 4, ce SMS n'existait pas et le push partait sur le moment. Le lot a ouvert une fenêtre de six heures.
Même défaut pour une suspension suivie d'une reprise dans la nuit : les deux avis partent à 07:00, dans un ordre qui suit
l'identifiant de la ligne (aléatoire), et le dernier lu peut dire « suspendu » pour un événement en ligne.

**Correctif proposé :** à la réservation, annuler un avis d'état au porteur dont l'état n'est plus celui annoncé (`SUSPENDU`
pour `EVENT_SUSPENDED_HOLDER`, `PUBLIE` pour `EVENT_REACTIVATED_HOLDER`), et annuler ces lignes en attente dans
`notif_cancel_on_status`.

### T2 — avis « de nouveau en ligne » d'une soirée déjà commencée, envoyé à 07:00 (moyenne)

Même cause. Une soirée commence à 02:00, elle est reprise à 01:30 : l'avis `EVENT_REACTIVATED_HOLDER` est reporté à 07:00,
puis envoyé à 07:00, cinq heures après le début et après la fin. Aucune revérification « événement commencé » n'existe pour
ce type. Pour le porteur, qui a reçu « suspendu » plus tôt, c'est le seul message qui lui dit de venir : il arrive trop tard.

**Correctif proposé :** pour un avis lié à un événement, ne pas reporter si le début tombe avant la fin de la plage (envoi
immédiat), et annuler à la réservation un avis d'état dont l'événement a commencé, comme pour les rappels.

**T2 adapté le 20/11 (décision du chef de projet).** La règle des 12 h du correctif est voulue : un avis lié à un événement
qui commence dans moins de 12 h, ou qui est en cours, part tout de suite, même la nuit. La précondition de l'ancien T2
(« reporté à 07:00 » pour une soirée à 02:00) contredisait cette règle. T2 devient deux cas, avec le même but : **l'avis
n'arrive jamais après le début.**
- **T2a** : un avis préparé à 01:30 pour une soirée à 02:00 doit partir tout de suite, avant le début (statut `SENT`, un
  SMS reçu, heure d'envoi avant le début).
- **T2b** : un avis reporté la nuit pour un événement lointain (à plus de 12 h, précondition « reporté ») doit être annulé à
  l'envoi (`CANCELLED`, aucun SMS) si la soirée a été avancée au même jour, 02:00 → 05:00, et qu'elle est donc finie à
  07:00. L'avance est faite sur les seules colonnes de date, comme `shiftEventDates`, mais en heures fixes.

Sur `finition-4/rouges` (code du lot avant correctif), T2a est rouge (reporté à 07:00) et T2b est rouge (envoyé à 07:00).

## 3. SMS — un trou

Ce qui tient :
- **Envoi en masse vers des numéros saisis : bloqué en amont.**
  - Transferts : 3 par billet et 10 par compte et par jour (`app/api/tickets/[id]/transfer/route.ts:70-86`). Le SMS
    d'annulation d'un transfert (`TRANSFER_CANCELLED`, vers le numéro saisi) n'est plus soumis à la limite par compte depuis
    le lot (`lib/notifications/dispatcher.ts`, `smsActorLimited`), mais il suit une offre : au plus 10 par jour.
  - Invitations : 50 par compte et par jour, 3 par numéro (`lib/tickets/invitation.service.ts:117`) ; `INVITATION_RECEIVED`
    garde la limite de 30 par compte.
  - Invitations de contrôleur et renvois (`controller_invitation_resend`) : type `CONTROLLER_INVITATION`, limite par compte
    gardée.
- **Un segment au pire cas (G3).** Testé sur les SMS nouveaux ou élargis, avec des valeurs extrêmes réalistes : titre de 60
  caractères avec `’`, `—`, `&`, `[ ]` et un emoji, porte de 34 caractères, 12 345 billets, 123 456 789 F CFA. Chaque SMS reste
  en alphabet GSM-7 de base et fait au plus 160 caractères.
  - Marge nulle : l'alerte de porte fait **160 caractères pile** à 1 234 refus sur 60 minutes (durée maximale du réglage
    `access.refusal_alert_minutes`). Elle passerait à 2 segments à partir de 10 000 refus, ce qui n'est pas réaliste.

### T3 — les SMS facultatifs des ventes épuisent la limite par numéro et font perdre un SMS indispensable (moyenne)

La limite par destinataire (`SMS_PER_PHONE_DAY`, 30 par jour en production, `lib/env.ts:62`) est un seul compteur pour tous
les SMS non OTP d'un numéro (`lib/sms/sms-guard.ts:117`). Ce compteur est commun aux facultatifs et aux indispensables.

La finition 4 ajoute à l'organisatrice deux flux réguliers :
- un SMS de ventes toutes les 30 minutes par événement (`SALES_UPDATE_SMS`, facultatif, `20261125000003_f4_ventes.sql:133`) ;
- un SMS de demandes de remboursement toutes les 15 minutes par événement (`PARTNER_REFUND_REQUESTS`, `…:671`).

Une seule journée de ventes, de 07:00 à 21:30, fait 30 SMS. Le soir, l'alerte « refus en série à une porte »
(`SCAN_REFUSALS_ALERT`, indispensable) est refusée par la garde. La ligne passe `SKIPPED SMS_RECIPIENT_CAP`
(`lib/notifications/dispatcher.ts:333-334`) : perdue, jamais retentée. Il en va de même, ce jour-là, pour l'écart de caisse,
les remboursements bloqués ou un retrait versé. Avec plusieurs événements en vente, le seuil est atteint plus tôt.

Les plafonds par numéro tiennent bien (rien ne passe au-delà de 30). C'est leur partage qui fait perdre l'indispensable.

**Correctif proposé (au choix du client) :**
- un compteur par numéro propre aux SMS facultatifs, plus bas, l'indispensable gardant le sien ;
- ou un plafond quotidien de SMS de ventes par organisatrice (par exemple 6), le reste restant sur la cloche et le résumé du
  matin.

## 4. Données — tenu

- **Avis groupés et résumés : aucune donnée d'acheteur.**
  - `NEW_ORDER` et `SALES_UPDATE_SMS` contiennent `notif_event_data` (événement), `payment_id` et des compteurs
    (`notif_sale_recorded`).
  - `PARTNER_REFUND_REQUESTS` contient `notif_pros_event_data` et des compteurs.
  - `PARTNER_DAILY_SUMMARY` ne contient que des sommes (`notification_daily_checks`).
  - `CASH_REFUND_MARKED_BY_ADMIN` porte la référence de la vente, pas l'acheteur.
  - **G5, vert.** Après trois achats et la vente complète, aucune ligne destinée à l'organisatrice (`template_data`) ni aucun
    SMS qu'elle reçoit ne contient le nom, le prénom, le numéro (deux formes) ou l'email de l'acheteur.
- **Noms masqués.** Le masque est posé en base, avant la mise en file (`controller_invitation_notify_partner`, `team_mask_name`,
  `20261115000002_finition1_equipe.sql:126-128`) : le nom complet n'est jamais dans les données de l'avis. Le SMS ajouté par la
  finition 4 garde `Ou*** B***` tel quel (G3).

## 5. Bienvenue et merci — tenu

- **Une seule bienvenue.** La clé est `ENTRY_WELCOME:<compte>:<événement>`, et l'insertion se fait par
  `ON CONFLICT DO NOTHING` (`notif_enqueue`).
- **G6, vert.** Deux billets du même porteur passent au même instant à deux portes (deux transactions concurrentes). La
  seconde attend la première sur la clé, puis tombe sur « Entrée validée ». Résultat : une bienvenue par canal, un merci par
  canal, pas d'« Entrée validée » pour le premier billet.
- **Pas de merci sans entrée (G7).** Le merci n'est mis en file qu'avec la bienvenue (`20261125000004_f4_spectateur.sql:41-57`),
  c'est-à-dire au passage d'un billet de `VALIDE` à `UTILISE`. Aucune instruction ne repasse un billet `UTILISE` à `VALIDE`
  (recherche dans toutes les migrations).
  - Limite assumée par le lot : le titulaire de plusieurs billets reçoit la bienvenue quand un ami entre avec l'un d'eux.
- **Pas de merci pour un événement annulé (G1).** Il est annulé à l'envoi (`20261125000002_f4_nuit.sql:248`).

## 6. Risque de fusion (sans test : la branche seule est saine)

**R1 — le lot 10b efface la recopie de `notif_cashouts_notify` faite par la finition 4.**

`origin/lot10b/salles-ecrans` (`dae4ca5d8`) recopie la même fonction depuis la même base (`20261123000106_l11a_annulation.sql`)
dans `20261126000003_l10b_avis.sql`. Ce fichier est daté après celui de la finition 4 (`20261125000003`), donc il est rejoué
en dernier quel que soit l'ordre de fusion. Après les deux fusions, la base aurait la version 10b, sans les changements de la
finition 4 :
- plus d'auteur (`by`) ;
- plus de canaux choisis : avec le registre élargi, SMS et push partiraient même pour le client et l'annulation ;
- plus d'avis groupé `PARTNER_REFUND_REQUESTS` ;
- plus de `not_paid`.

`f4-messages` le verrait (assertion `by = ORGANIZER`), mais seulement si la CI tourne après la seconde fusion. Le diff de la
version 10b avec celle du lot 11a se limite à l'avis `HALL_REFUND_PAID`.

**À la seconde fusion :** une migration datée après `20261126000003` qui réunit les deux versions.

## 7. Tests et runs

| Suite | Tests | Attendu | Run 468 |
|---|---|---|---|
| `tests/audit/cvf4-1-nuit.test.ts` | T1, T2, G1, G2 | T1, T2 rouges | 2 rouges (T1, T2), 2 verts |
| `tests/audit/cvf4-2-sms.test.ts` | T3, G3 (×12) | T3 rouge | 1 rouge (T3), 12 verts |
| `tests/audit/cvf4-3-argent-donnees.test.ts` | G4, G5 | verts | 2 verts |
| `tests/audit/cvf4-4-bienvenue.test.ts` | G6, G7 | verts | 2 verts |

Méthode pour T1, T2 et T3 : les lignes de la boîte d'envoi sont écrites directement à une heure simulée de la nuit, comme dans
`tests/parcours/f4-messages.test.ts`, puisque la CI ne choisit pas son heure. Toutes les transitions d'événement passent par
les RPC réelles. T3 pose `SMS_PER_PHONE_DAY=30`, la valeur de production, dans son seul processus ; les autres suites tournent
à 1 000.

Sortie brute du run 468 (`runs/468-44591822272`, branche `ci-results`) :

```
tests/audit/cvf4-1-nuit.test.ts            FAIL     1.1s      1     .test-logs/tests__audit__cvf4-1-nuit.test.ts.log
tests/audit/cvf4-2-sms.test.ts             FAIL     819ms     1     .test-logs/tests__audit__cvf4-2-sms.test.ts.log
tests/audit/cvf4-3-argent-donnees.test.ts  PASS     1.1s      0     .test-logs/tests__audit__cvf4-3-argent-donnees.test.ts.log
tests/audit/cvf4-4-bienvenue.test.ts       PASS     1.0s      0     .test-logs/tests__audit__cvf4-4-bienvenue.test.ts.log

    not ok 1 - T1 : avis « suspendu » reporté la nuit, événement annulé avant 07:00 → ne doit pas partir à 07:00
      error: 'SMS EVENT_SUSPENDED_HOLDER envoyé à 07:00 pour un événement ANNULÉ (SENT ) ; SMS reçu : « Event Village : TEST Finance cvf4-t1 179511... est suspendu pour le moment. Vos billets restent valables, vous serez prévenu de la suite. »'
    not ok 2 - T2 : avis « de nouveau en ligne » d’une soirée qui commence à 02:00, préparé à 01:30 → ne doit pas partir à 07:00
      error: 'EVENT_REACTIVATED_HOLDER envoyé à 07:00 pour une soirée commencée à 02:00 (début 2026-11-23T02:00:00.000Z) : « Event Village : TEST Rappels cvf4-t2 179511... reprend comme prévu. Vos billets restent valables. »'
    ok 3 - G1 : merci du lendemain d’un événement annulé → annulé à l’envoi
    ok 4 - G2 : avis urgent à 02:00 (refus en série à une porte) → part tout de suite

    not ok 1 - T3 : 30 SMS de ventes (07:00 → 21:30) puis l’alerte de porte du soir → l’alerte doit partir
      error: |-
        SCAN_REFUSALS_ALERT (indispensable) SKIPPED SMS_RECIPIENT_CAP — Trop de demandes de SMS. Réessayez dans 308 minutes. ; SMS reçus par l'organisatrice : 30 avant, 30 après
        'SKIPPED' !== 'SENT'
    ok 1 - G3 … ok 12 - G3 (douze SMS en un segment, noms masqués gardés)

    ok 1 - G4 : confirmations simultanées puis rejeux → une émission, un avis, une commande comptée
    ok 1 - G5 : boîte d’envoi et SMS de l’organisatrice sans nom, numéro ni email d’acheteur
    ok 1 - G6 : deux billets du même porteur à deux portes au même instant → une bienvenue, un merci
    ok 2 - G7 : porteur jamais entré → ni bienvenue ni merci
```

Run 467 (`e00f86bc7`) : T1 était rouge pour une **mauvaise raison**. Le test faisait annuler l'événement suspendu par la
partenaire, ce que la base refuse :

```
advanceEventTo(…, ANNULE) : étape SUSPENDU → ANNULE (event_cancel, acteur PARTENAIRE …) refusé : {"ok":false,"code":"TRANSITION_NOT_ALLOWED","message":"Un événement « Suspendu » ne peut pas être annulé."}
```

Mon test a été corrigé : l'annulation passe par l'administration (`cancelledBy: 'ADMIN'`, transition SUSPENDU → ANNULE ADMIN,
`20261102000003_lot5_cycle.sql:63`), commit `8753a685f`. Aucune assertion n'a été changée. T2, T3 et G1 à G7 étaient déjà
au même résultat au run 467.

**Modification du 20/11, T2 (décision du chef de projet sur la règle des 12 h).** La précondition « reporté à 07:00 » de
l'ancien T2 est retirée : elle contredisait une règle voulue. T2 est remplacé par T2a et T2b (§ 2), avec le même but, dit
par des assertions plus strictes : T2a exige un envoi avant le début, T2b exige `CANCELLED` sans aucun SMS (l'ancien T2
exigeait seulement « pas SENT »). Le commentaire est dans le test (`tests/audit/cvf4-1-nuit.test.ts`). Ce sont les deux
seules modifications de mes tests.

Hors CI : les douze G3 sont aussi passés sur le poste (`npx tsx --test --test-name-pattern G3`). Contrôle de types et lint
des quatre suites : sans erreur.

## 8. Écartés après vérification

- **`EVENT_CHANGED` reporté la nuit ?** Non : il est `ESSENTIAL` depuis le lot 9 bis (`20261109000003_lot9bis_registre.sql:88`),
  donc `SEND`. Un changement de lieu ou d'heure part tout de suite, y compris la nuit.
- **Course entre deux portes sur la bienvenue ?** Non : `ON CONFLICT DO NOTHING` sur la clé (G6).
- **SMS hors GSM-7 à cause d'une saisie (titre, nom, porte) ?** Non : `smsVar` translittère, emoji et crochets compris (G3).
- **`TRANSFER_CANCELLED` et `TRANSFER_REVOKED` sans limite par compte ?** C'est exact depuis le lot, et le test du lot range ces
  numéros saisis parmi les « destinataires connus ». Mais le volume reste borné par les quotas d'offre de transfert (§ 3).
  Point de cohérence à signaler, pas un trou.
- **Observation hors finition 4 :** les numéros d'invitations non réclamées reçoivent `EVENT_CHANGED` par SMS sans limite
  par compte (`event_change_notify`, sans `actor_id`). Le volume est borné par 50 invitations par jour et 2 SMS par heure et
  par numéro. Comportement antérieur au lot.
