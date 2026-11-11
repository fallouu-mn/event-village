# Recette de la billetterie

Ce document a trois parties : la matrice qui relie chaque exigence du cahier des charges V3.0 à sa preuve, la liste des anomalies, et le cahier de recette à dérouler à la main sur event-village-dev. La source des exigences est `docs/CDC-V3.md`.

## 1. Résumé

| Statut | Lignes |
|---|---|
| fait | 49 |
| partiel | 35 |
| non fait | 2 |
| écarté | 6 |
| hors périmètre | 14 |
| total | 106 |

Les 49 lignes « fait » ont toutes leurs preuves lues vertes au run 113. Aucune n’attend de preuve.

Le run 113 a tourné le 08/11/2026 sur le commit d255bf3, écrans compris : 244 suites vertes sur 244 et toutes les phases e2e vertes, dont 349 captures sur deux écrans et le parcours `e2e/recette.spec.ts`, 9 actes sur 9. Les 39 cas de capture ignorés sont des vues que leur écran ne prévoit pas. Le run 110 (sha e6c23d1, 212 suites vertes sur 250) est le run « avant » du lot 9 : ses rouges annoncés sont verts au run 113.

Limite connue : l’annexe de l’audit (`docs/audit-evenementiel-annexe-constats.md`) n’a été lue qu’en version condensée à la découverte du lot. Le cahier des charges et chaque test cité ont été lus en entier.

## 2. Légende

| Statut | Sens |
|---|---|
| fait | Le code existe et chaque partie de l’exigence a une assertion dans un test dont le corps a été lu |
| partiel | Une partie manque, ou un affichage ou une route n’a pas d’assertion |
| non fait | Rien n’existe, ou seulement une donnée inutilisée |
| écarté | Écarté par une décision écrite |
| hors périmètre | Module non billetterie, renvoyé à ses lots par la consigne |

La colonne CI dit ce qui a été lu dans les journaux bruts de la branche `ci-results`, et rien d’autre :

- `vert au run N` : chaque test cité y est lu `ok` ;
- `sans objet` : aucun test n’est cité.

Une ligne « fait » exige les deux : le corps de chaque test cité est lu, et son résultat aussi.

`M/` désigne `supabase/migrations/`. Pour les migrations, le numéro de ligne est celui de la dernière définition de la fonction. Les six suites à la racine de `tests/` qui ne prouvaient rien (A21) ont été supprimées au lot 9 et ne sont pas citées. Q1 à Q6 renvoient à la section 6, PO aux points ouverts du contrat du lot.

## 3. Matrice de traçabilité

### Parties I et II : principes et rôles

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §1, §6 P1, §183 | Un compte, plusieurs services ; un client = un compte | partiel | `M/0001_initial_schema.sql:214` | `tests/parcours/inscription-numero-dabord.test.ts:126`, `tests/parcours/inscription-numero-dabord.test.ts:194` | vert au run 113 | A12 : un client connecté ne peut pas devenir partenaire |
| §6 P2, §9 | Un partenaire cumule plusieurs activités | fait | `M/20261106000006_lot8_profil.sql:18`, `app/api/partner/profile/route.ts` | `tests/parcours/partenaire-profil-rpc.test.ts:208`, `tests/parcours/partenaire-profil-rpc.test.ts:229` | vert au run 113 | — |
| §6 P3, §85 | Le parrainage fait partie du compte client | fait | `app/wallet/page.tsx`, `M/20261106000004_lot8_commissions.sql:37` | `tests/parcours/finance-commissions.test.ts:256` | vert au run 113 | — |
| §6 P4, §13, §183, Annexe G | Ambassadeur = client, statut attribué par le SUPERADMIN | fait | `app/api/admin/users/route.ts`, `M/0001_initial_schema.sql:218` | `tests/parcours/acces-securite-urgente.test.ts:211`, `tests/parcours/acces-securite-urgente.test.ts:228`, `tests/security/r15-statut-ambassadeur.test.ts:27` | vert au run 113 | — |
| §6 P5, §74, §184 | Paiement Event Village distinct du hors plateforme | fait | `M/20261101000003_lot3_moteur.sql:151` | `tests/parcours/finance-hors-plateforme.test.ts:123`, `tests/parcours/finance-hors-plateforme.test.ts:142` | vert au run 113 | — |
| §6 P6, §80, §92 | Parrainage sur le revenu net éligible, jamais sur le brut | fait | `M/20261106000004_lot8_commissions.sql:37` | `tests/parcours/finance-commissions.test.ts:256`, `tests/parcours/commissions-plafond.test.ts:164` | vert au run 113 | — |
| §7 | Types d’utilisateurs | fait | `lib/auth/roles.ts` | `tests/parcours/attribution-roles.test.ts:73`, `tests/security/r1-inscription-roles.test.ts:31` | vert au run 113 | — |
| §10 | Administrateur : seulement ses fonctions | fait | `lib/admin/admin-auth.ts` | `tests/parcours/securite-admin-lot7.test.ts:177`, `tests/parcours/securite-admin-lot7.test.ts:311`, `tests/parcours/securite-admin-lot7.test.ts:340`, `tests/parcours/admin-evenements.test.ts:419` | vert au run 113 | — |
| §11 | Contrôleur : scanner, vérifier, paiement hors plateforme selon permission | fait | `app/api/controller/scan/route.ts`, `app/api/controller/counter-sale/route.ts` | `tests/parcours/acces-guichet.test.ts:162`, `tests/parcours/acces-encaissement.test.ts:69`, `tests/parcours/pilotage-equipe-caisse.test.ts:94`, `e2e/recette.spec.ts:616` | vert au run 113 | Réservations : hors périmètre |
| §12 | Superadmin : tous les droits, dont taux et durées | partiel | `app/admin/referral/page.tsx`, `app/api/admin/users/route.ts` | `tests/parcours/changement-role-admin.test.ts:42`, `tests/parcours/bootstrap-superadmin.test.ts:26`, `tests/parcours/finance-reglages.test.ts:91` | vert au run 113 | A1 corrigée, mais taux et durées par personne non construits (Q5) |

### Partie III : compte client

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §14, §145 | Création : prénom, nom, téléphone, email, mot de passe, OTP | fait | `app/api/auth/register/route.ts`, `app/api/auth/register/start/route.ts` | `tests/parcours/inscription-numero-dabord.test.ts:147`, `tests/parcours/inscription-numero-dabord.test.ts:194`, `tests/parcours/inscription-numero-dabord.test.ts:254`, `tests/parcours/email-optionnel.test.ts:66`, `e2e/recette.spec.ts:487` | vert au run 113 | Email facultatif : choix du lot 1C.8 |
| §15 | Profil modifiable : photo, nom, téléphone, email, préférences | fait | `app/profile/page.tsx`, `components/profile/ProfileForm.tsx`, `components/profile/PhoneChangeDialog.tsx`, `components/profile/AvatarEditor.tsx`, `app/profile/notifications/page.tsx`, `app/api/account/profile/route.ts`, `app/api/account/phone/confirm/route.ts`, `app/api/account/avatar/route.ts`, `M/20261108000004_lot9_compte.sql:148` | `tests/parcours/compte-profil.test.ts:186`, `tests/parcours/compte-profil.test.ts:235`, `tests/parcours/compte-profil.test.ts:570`, `tests/parcours/compte-profil.test.ts:577`, `tests/parcours/compte-numero.test.ts:286`, `tests/parcours/compte-numero.test.ts:488`, `tests/parcours/compte-numero.test.ts:540`, `tests/parcours/compte-numero.test.ts:1042`, `tests/parcours/compte-photo.test.ts:252`, `tests/parcours/compte-photo.test.ts:468`, `tests/parcours/compte-photo.test.ts:491`, `tests/parcours/compte-photo.test.ts:670`, `tests/security/r27-avatars.test.ts:184`, `tests/security/r27-avatars.test.ts:258`, `tests/security/r7-profil-colonnes.test.ts:46`, `tests/parcours/notif-preferences.test.ts:367` | vert au run 113 | A6 corrigée : une route, jamais d’écriture directe par REST |
| §16 | Recherche par événement et par localisation | fait | `app/api/events/route.ts`, `app/explore/page.tsx`, `lib/events/catalog-client.ts` | `tests/parcours/decouverte-recherche.test.ts:88`, `tests/parcours/decouverte-recherche.test.ts:97`, `tests/parcours/decouverte-recherche.test.ts:111`, `tests/parcours/decouverte-recherche.test.ts:122`, `tests/parcours/decouverte-recherche.test.ts:129`, `tests/parcours/decouverte-recherche-lot9.test.ts:87`, `tests/parcours/decouverte-recherche-lot9.test.ts:98`, `tests/parcours/decouverte-recherche-lot9.test.ts:120`, `tests/parcours/decouverte-ecrans.test.ts:95`, `tests/parcours/decouverte-ecrans.test.ts:293`, `e2e/recette.spec.ts:487` | vert au run 113 | A28 corrigée : le catalogue passe q et city au serveur. Restaurant, salle, produit, table : hors périmètre ; prestataire : par le nom de l’organisateur seulement |
| §17 | Événements populaires et proches | fait | `app/api/events/popular/route.ts`, `lib/events/popular.service.ts`, `components/events/HomeDiscovery.tsx`, `app/api/profile/city/route.ts`, `M/20261108000003_lot9_decouverte.sql:27` | `tests/parcours/decouverte-populaires.test.ts:157`, `tests/parcours/decouverte-populaires.test.ts:186`, `tests/parcours/decouverte-populaires.test.ts:212`, `tests/parcours/decouverte-populaires.test.ts:233`, `tests/parcours/decouverte-populaires.test.ts:362`, `tests/parcours/decouverte-populaires.test.ts:380`, `tests/parcours/decouverte-cache.test.ts:54`, `tests/parcours/decouverte-cache.test.ts:67`, `tests/parcours/decouverte-cache.test.ts:89`, `tests/parcours/decouverte-ville.test.ts:108`, `tests/parcours/decouverte-ville.test.ts:276`, `tests/parcours/decouverte-ecrans.test.ts:154`, `tests/parcours/decouverte-ecrans.test.ts:317`, `tests/parcours/decouverte-ecrans.test.ts:328`, `tests/parcours/decouverte-ecrans.test.ts:335` | vert au run 113 | A7 corrigée (Q4 tranchée) : Populaires selon les billets vendus sur 7 jours, proches selon la ville du profil ou de l’appareil, sans géolocalisation. Restaurants, offres, plats du jour, salles, prestataires : hors périmètre |
| §18, §19 | Réservations et commandes du client | hors périmètre | — | — | sans objet | — |
| §20, §138 | Billet consulté : événement, catégorie, prix, QR, statut | partiel | `app/api/tickets/route.ts`, `components/tickets/TicketCard.tsx` | `tests/parcours/acces-qr.test.ts:340`, `tests/parcours/confirmation-achat.test.ts:579`, `e2e/fumee.spec.ts:91`, `e2e/recette.spec.ts:797` | vert au run 113 | Catégorie et prix de la carte sans assertion d’affichage |
| §21, §8 | Historique : tickets, paiements, commissions, parrainage | partiel | `app/tickets/page.tsx`, `app/wallet/page.tsx`, `app/profile/payments/page.tsx`, `app/api/account/payments/route.ts`, `M/20261108000004_lot9_compte.sql:307` | `tests/parcours/finance-commissions.test.ts:475`, `tests/parcours/compte-paiements.test.ts:132`, `tests/parcours/compte-paiements.test.ts:233`, `tests/parcours/compte-paiements.test.ts:461`, `tests/parcours/compte-paiements.test.ts:475` | vert au run 113 | A17 corrigée : Mes paiements. A9 : historique du parrainage incomplet ; commandes et réservations : hors périmètre |
| §22, §124 | Notifications : SMS, WhatsApp, Email, Push | partiel | `lib/notifications/dispatcher.ts` | `tests/parcours/notif-canaux.test.ts:213`, `tests/parcours/notif-canaux.test.ts:313`, `tests/parcours/notif-canaux.test.ts:494`, `tests/parcours/notif-canaux.test.ts:802` | vert au run 113 | A8 : WhatsApp absent (Q1) |

### Partie IV : espace partenaire

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §23, §145 | Inscription avec pièces | fait | `app/api/partner/register/route.ts`, `app/partner/register/page.tsx` | `tests/parcours/documents-inscription.test.ts:54`, `tests/parcours/documents-inscription.test.ts:71`, `tests/parcours/notif-admins.test.ts:208`, `e2e/recette.spec.ts:323` | vert au run 113 | — |
| §24, §129 | Validation : en attente, validé, refusé, suspendu | fait | `M/20261103000006_lot6_pros_admin.sql:698` | `tests/parcours/notif-pros.test.ts:665`, `tests/parcours/notif-pros.test.ts:679`, `tests/parcours/notif-pros.test.ts:700`, `tests/parcours/notif-pros.test.ts:748`, `tests/parcours/revocation-sessions.test.ts:81`, `e2e/recette.spec.ts:323`, `e2e/recette.spec.ts:944` | vert au run 113 | — |
| §25 à §27 | Essai et packs | hors périmètre | — | — | sans objet | — |
| §28 | Page professionnelle | hors périmètre | — | — | sans objet | — |
| §29 | Tableau de bord : ventes, tickets, revenus, paiements, statistiques | partiel | `lib/partner/partner-dashboard.service.ts`, `app/partner/dashboard/page.tsx` | `tests/parcours/finance-rapports.test.ts:106`, `tests/parcours/finance-rapports.test.ts:116`, `tests/parcours/partenaire-lot7.test.ts:750`, `tests/parcours/partenaire-lot7.test.ts:892`, `tests/parcours/pilotage-apercu-ventes.test.ts:89`, `e2e/recette.spec.ts:728` | vert au run 113 | Montants de /partner/dashboard contrôlés par leur type, pas par leur valeur. Réservations, commandes, abonnement : hors périmètre |

### Partie V : événements

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §30, §137 | Titre, description, date, heure, lieu, image, programme | fait | `components/events/EventForm.tsx`, `lib/validations/event.ts`, `M/20261106000001_lot8_canaux.sql:637` | `tests/parcours/edition-formulaire.test.ts:378`, `tests/parcours/edition-validation.test.ts:321`, `tests/parcours/edition-validation.test.ts:424`, `tests/parcours/edition-validation.test.ts:496`, `e2e/fumee.spec.ts:91`, `e2e/recette.spec.ts:323` | vert au run 113 | — |
| §31 | Statuts du cycle (ANNULE ajouté pour §41) | fait | `lib/events/event-status.ts`, `M/20261103000005_lot6_billetterie.sql:942` | `tests/parcours/cycle-transitions.test.ts:242`, `tests/parcours/cycle-transitions.test.ts:272`, `tests/parcours/cycle-transitions.test.ts:328`, `tests/parcours/cycle-transitions.test.ts:375`, `tests/parcours/cycle-cron.test.ts:176`, `tests/parcours/cycle-visibilite.test.ts:141`, `tests/parcours/cycle-visibilite.test.ts:216`, `tests/parcours/evenement-404.test.ts:198` | vert au run 113 | — |
| §32 | Programme : artistes, horaires, activités, intervenants | fait | `components/events/EventForm.tsx`, `app/events/[id]/page.tsx` | `tests/parcours/edition-validation.test.ts:458`, `tests/parcours/edition-validation.test.ts:476`, `e2e/recette.spec.ts:323`, `e2e/recette.spec.ts:487` | vert au run 113 | — |
| §33 | Adresse, accès, parking, contact, règles | partiel | `components/events/EventForm.tsx`, `app/api/events/[id]/route.ts`, `app/events/[id]/page.tsx` | `tests/parcours/edition-formulaire.test.ts:562`, `e2e/recette.spec.ts:487` | vert au run 113 | A15 : adresse, accès, parking et règles assertés à l’écran, contact de l’organisateur non |
| §34 | Services associés : ticketing, tables, communication, promotion | écarté | `app/api/events/route.ts` | `tests/parcours/edition-services.test.ts:195`, `tests/parcours/edition-services.test.ts:204`, `tests/parcours/edition-services.test.ts:223`, `tests/parcours/edition-services.test.ts:250` | vert au run 113 | Billetterie seule, tâche 5.9 (`docs/lot5-rapport.md:2870`). Origine client à confirmer |

### Partie VI : ticketing

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §35 | Catégorie, prix, quantité, début et fin de vente ; canaux de vente (consigne 8.0) ; invitations (consigne 9.0) | fait | `components/events/EventTicketing.tsx`, `components/partner/pilotage/InvitationsTab.tsx`, `app/api/partner/events/[id]/invitations/route.ts`, `lib/tickets/invitation.service.ts`, `M/20261106000001_lot8_canaux.sql:211`, `M/20261108000002_lot9_invitations.sql:348`, `M/20261108000002_lot9_invitations.sql:504` | `tests/parcours/edition-categories.test.ts:259`, `tests/parcours/edition-categories.test.ts:318`, `tests/parcours/edition-categories.test.ts:362`, `tests/parcours/paiement-controles.test.ts:53`, `tests/parcours/canaux-vente.test.ts:285`, `tests/parcours/canaux-vente.test.ts:294`, `tests/parcours/canaux-vente.test.ts:343`, `tests/parcours/canaux-vente.test.ts:368`, `tests/parcours/canaux-vente.test.ts:385`, `tests/parcours/canaux-vente.test.ts:491`, `tests/parcours/canaux-vente.test.ts:506`, `tests/parcours/canaux-invariant.test.ts:235`, `tests/parcours/canaux-interface.test.ts:197`, `tests/parcours/canaux-interface.test.ts:205`, `tests/parcours/canaux-interface.test.ts:275`, `tests/parcours/invitations.test.ts:165`, `tests/parcours/invitations.test.ts:294`, `tests/parcours/invitations.test.ts:363`, `tests/parcours/invitations.test.ts:381`, `tests/parcours/invitations.test.ts:492`, `tests/parcours/invitations-reclamation.test.ts:121`, `tests/parcours/invitations-annulation.test.ts:141`, `tests/parcours/invitations-course.test.ts:173`, `tests/parcours/invitations-quotas.test.ts:94`, `tests/parcours/invitations-quotas.test.ts:110`, `e2e/recette.spec.ts:323`, `e2e/recette.spec.ts:841` | vert au run 113 | PO1 tranchée : une catégorie sans canal se distribue par l’onglet Invitations |
| §36, §179 | Choisir, commander, payer, recevoir | fait | `lib/payments/checkout.service.ts`, `M/20261106000003_lot8_paiement.sql:84` | `tests/parcours/achat-serveur.test.ts:59`, `tests/parcours/confirmation-achat.test.ts:574`, `tests/parcours/finance-affichage.test.ts:80`, `e2e/fumee.spec.ts:91`, `e2e/recette.spec.ts:487` | vert au run 113 | A41 corrigée : un visiteur commence l’achat sans compte, s’inscrit depuis l’achat et revient sur la fiche ; le paiement reste protégé |
| §37, §79, §111, Annexes C et F | Prix + frais de service : 1 000 / 50 / 15,75 / 34,25 | fait | `M/20261101000003_lot3_moteur.sql:47` | `tests/parcours/finance-moteur.test.ts:73`, `tests/parcours/finance-moteur.test.ts:95`, `tests/parcours/finance-moteur.test.ts:153`, `tests/parcours/finance-affichage.test.ts:87`, `tests/parcours/finance-affichage.test.ts:112` | vert au run 113 | — |
| §38 | Moyens intégrés : Wave et Orange Money | fait | `lib/validations/payment.ts` | `tests/parcours/paiement-operateur.test.ts:27`, `tests/samirpay-contrat.test.ts:97` | vert au run 113 | Carte retirée : choix du lot 2 (`docs/lot2-rapport.md:28`) |
| §39, §154 | QR unique, sécurisé, vérifiable, historisé | fait | `lib/security/totp.ts`, `M/20261108000005_lot9_nettoyage.sql:21` | `tests/parcours/acces-qr.test.ts:119`, `tests/parcours/acces-qr.test.ts:131`, `tests/parcours/acces-totp.test.ts:223`, `tests/parcours/acces-totp.test.ts:235`, `tests/parcours/acces-totp.test.ts:257`, `tests/parcours/acces-tracabilite.test.ts:90`, `tests/parcours/acces-tracabilite.test.ts:144` | vert au run 113 | — |
| §40 | Scan : vert, ou rouge invalide ou déjà utilisé | fait | `M/20261108000005_lot9_nettoyage.sql:21`, `lib/scan/scan-result.ts` | `tests/parcours/acces-tracabilite.test.ts:90`, `tests/parcours/acces-scan.test.ts:108`, `tests/parcours/acces-fenetre.test.ts:95`, `tests/parcours/acces-fenetre.test.ts:116`, `tests/parcours/scan-renvoi-seulement.test.ts:143`, `e2e/terrain.spec.ts:119`, `e2e/terrain.spec.ts:468`, `e2e/fumee.spec.ts:91`, `e2e/recette.spec.ts:616` | vert au run 113 | — |
| §41, §82, §184 | Annulation, remboursement, régularisations financière et de parrainage | fait | `M/20261106000003_lot8_paiement.sql:266`, `M/20261108000001_lot9_securite.sql:21`, `M/20261106000004_lot8_commissions.sql:123`, `components/partner/pilotage/TicketRefundPanel.tsx`, `components/admin/RefundsToRetry.tsx` | `tests/parcours/finance-annulation.test.ts:89`, `tests/parcours/finance-annulation.test.ts:140`, `tests/parcours/finance-remboursement-billet.test.ts:155`, `tests/parcours/finance-remboursement-billet.test.ts:231`, `tests/parcours/finance-commissions.test.ts:346`, `tests/parcours/finance-commissions.test.ts:375`, `tests/parcours/finance-commissions.test.ts:401`, `tests/parcours/commissions-plafond.test.ts:226`, `tests/parcours/commissions-plafond.test.ts:251`, `tests/parcours/double-paiement.test.ts:258`, `tests/parcours/admin-remboursements.test.ts:360`, `tests/parcours/admin-remboursements.test.ts:478`, `tests/parcours/admin-remboursements.test.ts:492`, `tests/parcours/pilotage-remboursement-billet.test.ts:235`, `tests/parcours/pilotage-remboursement-billet.test.ts:356`, `tests/parcours/pilotage-remboursement-billet.test.ts:369`, `e2e/fumee.spec.ts:91`, `e2e/recette.spec.ts:728`, `e2e/recette.spec.ts:797`, `e2e/recette.spec.ts:944` | vert au run 113 | — |

### Parties VII à IX : salles, tables, commandes

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §42 à §73 | Salles, tables, commandes | hors périmètre | `lib/features/flags.ts` | `tests/parcours/interrupteurs.test.ts:358` | vert au run 113 | Modules derrière interrupteurs, lots à venir |

### Partie X : paiements et finances

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §75 | Transaction, montant, client, partenaire, frais, agrégateur, revenu, statut | fait | `M/20261105000006_lot7_client.sql:24` | `tests/parcours/finance-moteur.test.ts:153`, `tests/parcours/finance-moteur.test.ts:191` | vert au run 113 | — |
| §76 | Hors plateforme hors du solde Event Village | fait | `M/20261101000003_lot3_moteur.sql:151` | `tests/parcours/finance-hors-plateforme.test.ts:142`, `tests/parcours/finance-hors-plateforme.test.ts:223`, `tests/parcours/finance-retraits.test.ts:215` | vert au run 113 | — |
| §77 | Frais agrégateur configurables par moyen de paiement | fait | `M/20261101000002_lot3_reglages.sql:64` | `tests/parcours/finance-moteur.test.ts:119`, `tests/parcours/finance-reglages.test.ts:91` | vert au run 113 | — |
| §78, Annexe F | Service direct : agrégateur à la charge d’Event Village | fait | `M/20261101000003_lot3_moteur.sql:47` | `tests/parcours/finance-moteur.test.ts:136` | vert au run 113 | — |
| §81 | Soldes | fait | `app/api/finance/balance/route.ts` | `tests/parcours/finance-retraits.test.ts:215`, `tests/parcours/finance-retraits.test.ts:242`, `tests/parcours/finance-retraits.test.ts:522` | vert au run 113 | — |
| §83, §118 | Retraits : Mobile Money, banque, 1 %, seuil 5 000 | partiel | `M/20261101000014_lot4_correctif_retraits_concurrents.sql:12`, `app/partner/finance/page.tsx` | `tests/parcours/finance-retraits.test.ts:301`, `tests/parcours/finance-retraits.test.ts:316`, `tests/parcours/finance-retraits.test.ts:325`, `e2e/recette.spec.ts:728` | vert au run 113 | A10 : virement non traité, réglage fermé par défaut |
| §84 | Rapprochement : paiements, frais, agrégateurs, revenus, commissions, retraits | partiel | `app/api/admin/finance/reconciliation/route.ts`, `lib/admin/admin.service.ts`, `app/admin/finance/page.tsx` | `tests/parcours/finance-hors-plateforme.test.ts:167`, `tests/parcours/paiement-reconciliation.test.ts:47`, `tests/parcours/paiement-reconciliation.test.ts:64` | vert au run 113 | Le test vérifie quelles lignes figurent, pas les montants ni les totaux de commissions et de retraits |

### Partie XI : parrainage, part billetterie

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §86 | Lien pour devenir client | fait | `app/api/referrals/my-stats/route.ts`, `app/register/page.tsx` | `tests/parcours/inscription-numero-dabord.test.ts:254`, `tests/parcours/parrainage-lien.test.ts:122`, `tests/parcours/parrainage-lien.test.ts:132`, `tests/parcours/parrainage-lien.test.ts:159`, `tests/parcours/parrainage-lien.test.ts:227` | vert au run 113 | — |
| §87, §88 | Lien prestataire, deux liens distincts | non fait | `app/api/auth/register/route.ts` | — | sans objet | A5, Q2 |
| §89 | Attribution non modifiable | fait | `M/0001_initial_schema.sql:594` | `tests/security/r13-parrainage-relations.test.ts:47`, `tests/security/r13-parrainage-relations.test.ts:57`, `tests/parcours/parrainage-gardes.test.ts:156`, `tests/parcours/parrainage-gardes.test.ts:167` | vert au run 113 | — |
| §90, §91, §94, Annexe C | N1 et N2 sur le net : 1,71 et 0,69 sur 34,25 (client standard) | fait | `M/20261106000004_lot8_commissions.sql:37` | `tests/parcours/finance-commissions.test.ts:256`, `tests/parcours/commissions-plafond.test.ts:203` | vert au run 113 | — |
| §93, Annexe B | Exemple abonnement | hors périmètre | — | — | sans objet | — |
| §95, §185 | Client standard : 5 %, 2 %, 12 mois | fait | `M/20261101000006_lot3_commissions.sql:49` | `tests/parcours/finance-commissions.test.ts:227`, `tests/parcours/inscription-numero-dabord.test.ts:254` | vert au run 113 | — |
| §96, §97, Annexe A | Prestataire 7/2 ; ambassadeur 7/2 et 10/3 | partiel | `M/20261101000006_lot3_commissions.sql:49` | `tests/parcours/finance-commissions.test.ts:227` | vert au run 113 | A5 : grille en base, lignes prestataire jamais utilisées ; N2 à 2 % (décision) |
| §98, §99 | Personnalisation, durées, historique, sans rétroactivité | partiel | `app/api/admin/users/route.ts`, `app/admin/referral/page.tsx` | `tests/parcours/acces-securite-urgente.test.ts:228`, `tests/parcours/finance-commissions.test.ts:284` | vert au run 113 | A1 : la fausse sauvegarde est retirée, la personnalisation n’existe pas (Q5, Q6) |
| §100 | Ticketing éligible | fait | `M/20261106000004_lot8_commissions.sql:37` | `tests/parcours/finance-commissions.test.ts:256` | vert au run 113 | — |
| §101 | Transactions non éligibles | partiel | `M/20261106000004_lot8_commissions.sql:37` | `tests/parcours/finance-hors-plateforme.test.ts:142`, `tests/parcours/finance-commissions.test.ts:346`, `tests/parcours/commissions-plafond.test.ts:213` | vert au run 113 | Aucun mécanisme pour la fraude et le chargeback |
| §102 | En attente puis disponible, 7 à 14 jours | fait | `M/20261101000006_lot3_commissions.sql:131` | `tests/parcours/finance-commissions.test.ts:256`, `tests/parcours/finance-commissions.test.ts:284`, `tests/parcours/finance-commissions.test.ts:315` | vert au run 113 | — |
| §103 | Commission annulée ou déduite, journalisée | fait | `M/20261106000004_lot8_commissions.sql:123` | `tests/parcours/finance-commissions.test.ts:346`, `tests/parcours/finance-commissions.test.ts:375`, `tests/parcours/finance-commissions.test.ts:401`, `tests/parcours/commissions-plafond.test.ts:226`, `tests/parcours/commissions-plafond.test.ts:251` | vert au run 113 | — |
| §104 | Anti-fraude | partiel | `M/0001_initial_schema.sql:593`, `M/0011_referral_codes.sql:100`, `M/20261108000001_lot9_securite.sql:567` | `tests/parcours/parrainage-gardes.test.ts:90`, `tests/parcours/parrainage-gardes.test.ts:128`, `tests/parcours/parrainage-gardes.test.ts:139`, `tests/security/r13-parrainage-relations.test.ts:67`, `tests/parcours/parrainage-boucle-update.test.ts:68`, `tests/parcours/parrainage-boucle-update.test.ts:79`, `tests/parcours/parrainage-boucle-update.test.ts:125`, `tests/parcours/parrainage-boucle-update.test.ts:136` | vert au run 113 | A11 : auto-parrainage et boucles prouvés, y compris par UPDATE (A27 corrigée). Rien sur les transactions artificielles |
| §105 | Retrait : 5 000 F, 1 %, Mobile Money, banque | partiel | `M/20261101000014_lot4_correctif_retraits_concurrents.sql:12` | `tests/parcours/finance-retraits.test.ts:301`, `tests/parcours/finance-retraits.test.ts:325`, `tests/parcours/finance-retraits.test.ts:424` | vert au run 113 | A10 |
| §106, §143 | Historique complet | partiel | `app/api/referrals/my-stats/route.ts`, `M/20261106000004_lot8_commissions.sql:37` | `tests/parcours/finance-commissions.test.ts:475`, `tests/parcours/commissions-plafond.test.ts:164` | vert au run 113 | A9 : ni filleul, ni taux, ni base, ni transaction à l’écran |

### Parties XII et XIII : modèle économique et communication

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §107 à §110, §112 à §117 | Modèle économique hors ticketing | hors périmètre | — | — | sans objet | — |
| §119 | ROI du parrainage | non fait | `app/api/admin/metrics/route.ts` | — | sans objet | A9 |
| §120 à §126 | Campagnes | hors périmètre | `app/admin/communications/page.tsx` | — | sans objet | Envoi désactivé, brouillon : décision 43 du lot 6 |

### Partie XIV : administration

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §127 | Vue globale du superadmin | partiel | `app/admin/dashboard/page.tsx`, `app/api/admin/metrics/route.ts` | `tests/parcours/finance-hors-plateforme.test.ts:132` | vert au run 113 | Route assertée sur le volume et le revenu net seulement ; affichage sans assertion |
| §128 | Utilisateurs | fait | `app/admin/users/page.tsx`, `app/api/admin/users/route.ts` | `tests/parcours/securite-admin-lot7.test.ts:177`, `tests/parcours/securite-admin-lot7.test.ts:237`, `tests/parcours/changement-role-admin.test.ts:42`, `e2e/recette.spec.ts:944` | vert au run 113 | — |
| §129 | Partenaires : validation, suspension, activités, statistiques | partiel | `app/admin/dashboard/page.tsx`, `app/api/admin/partners/[id]/status/route.ts` | `tests/parcours/notif-pros.test.ts:665`, `tests/parcours/notif-pros.test.ts:700`, `tests/parcours/notif-pros.test.ts:748`, `e2e/recette.spec.ts:323`, `e2e/recette.spec.ts:944` | vert au run 113 | Activités et statistiques du partenaire sans assertion à l’administration. Abonnement : hors périmètre |
| §130 | Supervision des services | fait | `app/admin/events/page.tsx`, `app/admin/services/page.tsx` | `tests/parcours/admin-evenements.test.ts:346`, `tests/parcours/admin-evenements.test.ts:464`, `tests/parcours/admin-evenements.test.ts:530`, `tests/parcours/admin-services-mention.test.ts:189` | vert au run 113 | Salles, tables, commandes : hors périmètre |
| §131 | Finance : transactions, frais, revenus, commissions, retraits, remboursements | partiel | `app/admin/finance/page.tsx`, `components/admin/RefundsToRetry.tsx` | `tests/parcours/finance-hors-plateforme.test.ts:167`, `tests/parcours/securite-admin-lot7.test.ts:311`, `tests/parcours/admin-remboursements.test.ts:180`, `tests/parcours/admin-remboursements.test.ts:360`, `tests/parcours/admin-remboursements.test.ts:478`, `tests/parcours/admin-remboursements.test.ts:492`, `tests/parcours/admin-remboursements.test.ts:510`, `e2e/recette.spec.ts:944` | vert au run 113 | A3 corrigée ; même manque que §84 pour les montants affichés |
| §132, §133 | Parrainage et ambassadeurs | partiel | `app/admin/referral/page.tsx` | `tests/parcours/acces-securite-urgente.test.ts:228`, `tests/parcours/admin-parrainage.test.ts:239`, `tests/parcours/admin-parrainage.test.ts:250` | vert au run 113 | A1 corrigée ; A9 : ni revenus, ni commissions, ni ROI par ambassadeur (Q5) |
| §134 | Journal d’activité | partiel | `app/api/admin/audit/route.ts`, `app/admin/audit/page.tsx` | `tests/parcours/admin-audit.test.ts:107`, `tests/parcours/admin-audit.test.ts:127`, `tests/parcours/admin-audit.test.ts:180`, `tests/parcours/admin-audit.test.ts:246`, `tests/parcours/admin-audit.test.ts:277`, `tests/parcours/admin-audit-lot9.test.ts:77`, `tests/parcours/admin-audit-lot9.test.ts:136`, `tests/parcours/admin-audit-lot9.test.ts:207`, `tests/parcours/admin-audit-lot9.test.ts:218`, `tests/parcours/admin-audit-lot9.test.ts:233`, `tests/parcours/admin-audit-lot9.test.ts:107` | vert au run 113 | A13, A24, A25, A38 corrigées ; champ « statut » absent de la table |

### Parties XV à XVIII : données, automatisation, sécurité, statistiques

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §135, §137 | Données client et événement | fait | `M/0001_initial_schema.sql:214`, `M/0001_initial_schema.sql:218` | `tests/parcours/inscription-numero-dabord.test.ts:194`, `tests/parcours/edition-formulaire.test.ts:378` | vert au run 113 | — |
| §136, §139 à §141 | Données partenaire, réservation, produit, commande | hors périmètre | — | — | sans objet | — |
| §142 | Données financières : du montant brut au revenu final | partiel | `M/20261101000003_lot3_moteur.sql:47` | `tests/parcours/finance-moteur.test.ts:153`, `tests/parcours/finance-commissions.test.ts:256` | vert au run 113 | « Revenu final » (net moins commissions) ni stocké ni calculé |
| §144 | API : agrégateur, Mobile Money, SMS, email, WhatsApp | partiel | `lib/samirpay/http-client.ts`, `lib/notifications/dispatcher.ts` | `tests/samirpay-contrat.test.ts:97`, `tests/parcours/notif-canaux.test.ts:313`, `tests/parcours/notif-canaux.test.ts:802` | vert au run 113 | A8 |
| §146, §147 | Automatisation des réservations et des commandes | hors périmètre | — | — | sans objet | — |
| §148 | Paiements : confirmation, frais, revenu, remboursement, retrait | fait | `supabase/ops/schedule-crons.sql`, `M/20261106000003_lot8_paiement.sql:84` | `tests/parcours/paiement-webhook.test.ts:52`, `tests/parcours/paiement-webhook.test.ts:101`, `tests/parcours/paiement-reconciliation.test.ts:47`, `tests/parcours/paiement-reconciliation.test.ts:64`, `tests/parcours/finance-moteur.test.ts:153`, `tests/parcours/finance-retraits.test.ts:325` | vert au run 113 | — |
| §149 | Chaîne du parrainage | partiel | `M/20261106000004_lot8_commissions.sql:37` | `tests/parcours/finance-commissions.test.ts:256`, `tests/parcours/finance-commissions.test.ts:315` | vert au run 113 | A5 : complète pour un filleul client, absente pour un prestataire |
| §150 | Confirmation, rappel, expiration, notification | fait | `lib/notifications/reminders.ts`, `lib/notifications/dispatcher.ts` | `tests/parcours/confirmation-achat.test.ts:574`, `tests/parcours/notif-rappels.test.ts:320`, `tests/parcours/notif-rappels-annulation.test.ts:310`, `tests/parcours/dette-transferts.test.ts:552`, `e2e/fumee.spec.ts:91` | vert au run 113 | Campagne : hors périmètre |
| §151 | Mot de passe, OTP, récupération | partiel | `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`, `lib/auth/otp-store.ts` | `tests/parcours/otp-serveur.test.ts:68`, `tests/parcours/otp-objet.test.ts:77`, `tests/parcours/invitation-identite.test.ts:95` | vert au run 113 | Récupération : le code et le compte visé sont testés, le changement final du mot de passe (Supabase) ne l’est pas |
| §152 | Droits minimaux | partiel | `lib/admin/admin-auth.ts`, `middleware.ts` | `tests/security/r1-inscription-roles.test.ts:31`, `tests/security/r8-controleur-lectures.test.ts:14`, `tests/schema/rls-toutes-tables.test.ts:12`, `tests/schema/fonctions-privileges.test.ts:86`, `tests/schema/fonctions-privileges.test.ts:124`, `tests/parcours/admin-audit-lot9.test.ts:77` | vert au run 113 | A24 corrigée. A30 et A31 : hors périmètre, derrière interrupteur |
| §153 | OTP pour les opérations sensibles | fait | `app/api/withdrawals/otp/route.ts` | `tests/parcours/otp-objet.test.ts:77`, `tests/parcours/otp-objet.test.ts:130`, `tests/parcours/finance-retraits.test.ts:325`, `e2e/recette.spec.ts:728` | vert au run 113 | — |
| §155 | Protection des données | fait | `middleware.ts`, `lib/supabase/server.ts` | `tests/security/r5-lectures-anon.test.ts:12`, `tests/security/r8-controleur-lectures.test.ts:42`, `tests/security/r18-partenaires-public.test.ts:61`, `tests/parcours/notif-admin.test.ts:293` | vert au run 113 | A30 : hors périmètre, service fermé |
| §156 | Traçabilité | fait | `M/20261105000001_lot7_reglages.sql:103`, `M/20261108000005_lot9_nettoyage.sql:21` | `tests/parcours/cycle-transitions.test.ts:579`, `tests/parcours/acces-tracabilite.test.ts:144`, `tests/parcours/finance-reglages.test.ts:159`, `tests/parcours/pilotage-equipe-caisse.test.ts:94` | vert au run 113 | — |
| §157 | Statistiques client | partiel | `app/tickets/page.tsx`, `app/wallet/page.tsx` | `tests/parcours/finance-commissions.test.ts:475` | vert au run 113 | A18 |
| §158 | Statistiques partenaire | partiel | `app/partner/stats/page.tsx`, `components/partner/pilotage/OverviewTab.tsx` | `tests/parcours/pilotage-apercu-ventes.test.ts:76`, `tests/parcours/pilotage-apercu-ventes.test.ts:89` | vert au run 113 | Pilotage assertés par événement ; /partner/stats sans assertion de chiffres |
| §159 | Statistiques des commandes | hors périmètre | — | — | sans objet | — |
| §160 | Tickets, participants, taux de présence | fait | `M/20261102000005_lot5_pilotage.sql:375`, `components/partner/pilotage/OverviewTab.tsx` | `tests/parcours/pilotage-invariant.test.ts:67`, `tests/parcours/pilotage-invariant.test.ts:100`, `tests/parcours/pilotage-entrees.test.ts:68`, `tests/parcours/pilotage-apercu-ventes.test.ts:98`, `tests/parcours/invitations.test.ts:579`, `tests/parcours/invitations.test.ts:591`, `e2e/recette.spec.ts:728` | vert au run 113 | — |
| §161 | Finance : volume, frais, revenus, commissions, retraits | partiel | `M/20261101000008_lot3_rapports.sql:77`, `app/api/admin/metrics/route.ts` | `tests/parcours/finance-hors-plateforme.test.ts:132` | vert au run 113 | Volume et revenu net assertés ; frais, commissions et retraits non |
| §162 | Parrainage : filleuls, apports, commissions, ROI | partiel | `app/api/admin/metrics/route.ts` | — | sans objet | A9 : total des commissions et nombre d’ambassadeurs seulement, sans test |
| §163 | Tableau de bord global | partiel | `app/admin/dashboard/page.tsx` | `tests/parcours/finance-hors-plateforme.test.ts:132` | vert au run 113 | Comme §127 ; parrainage réduit (A9) |

### Parties XX à XXIII : architecture, règles, livrables

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §2 à §5, §192 | Vision et objectifs | hors périmètre | — | — | sans objet | Pas d’exigence vérifiable |
| §178 | Architecture par espaces | fait | `app/admin/page.tsx`, `app/partner/page.tsx`, `app/controller/layout.tsx` | `e2e/fumee.spec.ts:91`, `e2e/recette.spec.ts:323`, `e2e/recette.spec.ts:616` | vert au run 113 | Salles, tables, produits : hors périmètre |
| §179 | Parcours client | fait | `lib/payments/checkout.service.ts` | `tests/parcours/acces-qr.test.ts:258`, `tests/parcours/parrainage-lien.test.ts:159`, `tests/parcours/finance-affichage.test.ts:80`, `e2e/fumee.spec.ts:91`, `e2e/recette.spec.ts:487`, `e2e/recette.spec.ts:616`, `e2e/recette.spec.ts:797` | vert au run 113 | Reçu PDF sans QR : voulu. A41 corrigée : achat commencé par un visiteur |
| §180 | Parcours partenaire | partiel | `app/partner/register/page.tsx`, `app/partner/events/new/page.tsx` | `e2e/recette.spec.ts:323`, `e2e/recette.spec.ts:453`, `e2e/recette.spec.ts:728` | vert au run 113 | Essai, page professionnelle, activation de services : hors périmètre |
| §181 | Parcours financier | fait | `M/20261101000003_lot3_moteur.sql:47` | `tests/parcours/finance-moteur.test.ts:153`, `tests/parcours/finance-invariant.test.ts:22` | vert au run 113 | — |
| §182 | Parcours parrainage | fait | `app/api/referrals/my-stats/route.ts`, `M/20261101000006_lot3_commissions.sql:131` | `tests/parcours/parrainage-lien.test.ts:159`, `tests/parcours/finance-commissions.test.ts:256`, `tests/parcours/finance-commissions.test.ts:315`, `tests/parcours/finance-retraits.test.ts:424` | vert au run 113 | — |
| §185 | Règles de parrainage, toutes lignes | partiel | `M/20261101000006_lot3_commissions.sql:49` | `tests/parcours/finance-commissions.test.ts:227` | vert au run 113 | A5 |
| §186, §187 | Règles de commande et de réservation | hors périmètre | — | — | sans objet | — |
| §188 | Web, mobile, back-office, API, base | partiel | `public/manifest.json` | `e2e/installable.spec.ts:109`, `e2e/installable.spec.ts:193` | vert au run 113 | Mobile = application web installable ; aucune application native, sans décision écrite |
| §189 | Documentation | partiel | `docs/guide-organisateur-entrees.md`, `docs/installer-application.md`, `docs/essai-local.md` | — | sans objet | A19 : guide client, guide d’administration |
| §190 | Tests : fonctionnels, sécurité, paiement, QR, charge, compatibilité, mobile, web | partiel | `playwright.config.ts`, `scripts/run-tests.mjs` | `e2e/fumee.spec.ts:91`, `e2e/recette.spec.ts:487`, `tests/schema/code-mort-lot9.test.ts:77` | vert au run 113 | Charge : derniers lots ; iPhone : aucun test possible. A21 corrigée |
| §191 | Déploiement | hors périmètre | — | — | sans objet | Derniers lots |
| Annexes D et E | Tarifs partenaires, services gratuits ou payants | hors périmètre | — | — | sans objet | — |

## 4. Écarts par décision du client

Ces lignes comptent dans le résumé. Aucun de ces points ne figure au cahier des charges : la colonne de droite donne leur trace écrite. Trois n’ont qu’une seule trace, la consigne du lot 8.

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| Décision 7.2 | Voix Wolof abandonnée | écarté | `components/scan/ScanResultPanel.tsx` | `tests/parcours/scanner-interface.test.ts:158` | vert au run 113 | Trace : `docs/lot7-rapport.md:132`, D52 (`docs/lot7-rapport.md:3950`), consigne du lot 8 |
| Décision 7.2 | Audio du scanner abandonné, la vibration le remplace | écarté | `lib/hardware/feedback.ts` | `tests/parcours/scanner-interface.test.ts:158`, `e2e/terrain.spec.ts:468` | vert au run 113 | Trace : `docs/lot7-rapport.md:132`, D50 et D52, consigne du lot 8 |
| Consigne 8.3 | Pas de Wallet Apple ou Google (rien à voir avec la page /wallet, portefeuille de parrainage) | écarté | — | — | sans objet | Trace unique : la consigne du lot 8 |
| Consigne 8.3 | Pas de panier multi-événements | écarté | `app/api/checkout/route.ts` | `tests/parcours/finance-affichage.test.ts:104` | vert au run 113 | Trace unique : la consigne du lot 8. §62 ne vise que les produits |
| Consigne 8.3 | Pas de billets à régler sur place | écarté | `lib/scan/scan-result.ts`, `M/20261108000005_lot9_nettoyage.sql:21` | `tests/parcours/nettoyage-sur-place.test.ts:99`, `tests/parcours/nettoyage-sur-place.test.ts:137`, `tests/parcours/nettoyage-sur-place.test.ts:143` | vert au run 113 | Trace : la consigne du lot 8, question de `docs/lot4-rapport.md:2488`. Code retiré au lot 9 (A16 corrigée) |

Autres choix écrits, qui s’écartent du cahier des charges :

- carte bancaire retirée : `docs/lot2-rapport.md:28` ;
- email facultatif : lot 1C.8, `docs/lot1c-rapport.md:17` ;
- services associés masqués : tâche 5.9, `docs/lot5-rapport.md:2870` ;
- campagnes en brouillon : décision 43 du lot 6 ;
- taux N2 à 2 % : consigne 8.2 c.

Sans aucune trace écrite : WhatsApp, virement bancaire, application native.

## 5. Anomalies

Gravité : **Élevée** trompe un utilisateur, ou bloque une opération d’argent ou une exigence nommée. **Moyenne** : exigence manquante avec un contournement. **Faible** : finition ou preuve manquante.

État : `corrigée` (test rouge puis correctif), `preuve ajoutée` (le code était juste, le test manquait), `listée` (non corrigée dans ce lot).

| Id | Gravité | Exigence | Constat | État | Référence | Test | CI |
|---|---|---|---|---|---|---|---|
| A1 | Élevée | §98, §133 | Fausse sauvegarde sur la page de parrainage de l’administration. Bouton et modale retirés, mention « La personnalisation des taux n’est pas disponible pour le moment. » | corrigée | `fix(8.3-A1)` 3fa31ed ; `app/admin/referral/page.tsx:157` | `tests/parcours/admin-parrainage.test.ts:229`, `tests/parcours/admin-parrainage.test.ts:239`, `tests/parcours/admin-parrainage.test.ts:250` | vert au run 113 |
| A2 | Élevée | §86 | Lien de parrainage mort. Lien sur l’adresse de l’application, /register lit ref et ouvre les options | corrigée | `fix(8.3-A2s)` b92928e, `fix(8.3-A2e)` 407d09c ; `app/api/referrals/my-stats/route.ts`, `app/register/page.tsx` | `tests/parcours/parrainage-lien.test.ts:122`, `tests/parcours/parrainage-lien.test.ts:159`, `tests/parcours/parrainage-lien.test.ts:227` | vert au run 113 |
| A3 | Élevée | §41, §131 | Relance d’un remboursement bloqué sans écran. Panneau sur les finances de l’administration, double étape, cas incertain sans bouton | corrigée | `fix(8.3-A3s)` 9a92e59, `fix(8.3-A3e)` 2506b89 et 5a6dcbc ; `app/api/admin/refunds/route.ts`, `components/admin/RefundsToRetry.tsx` | `tests/parcours/admin-remboursements.test.ts:180`, `tests/parcours/admin-remboursements.test.ts:360`, `tests/parcours/admin-remboursements.test.ts:478`, `tests/parcours/admin-remboursements.test.ts:492`, `tests/parcours/admin-remboursements.test.ts:510`, `e2e/recette.spec.ts:944` | vert au run 113 |
| A4 | Élevée | §41, §82 | Remboursement d’un billet sans écran. Recherche par numéro et double confirmation dans l’onglet Ventes | corrigée | `fix(8.3-A4s)` c1eabd6, `fix(8.3-A4e)` 18c69b8 ; `app/api/partner/events/[id]/tickets/lookup/route.ts`, `components/partner/pilotage/TicketRefundPanel.tsx` | `tests/parcours/pilotage-remboursement-billet.test.ts:138`, `tests/parcours/pilotage-remboursement-billet.test.ts:191`, `tests/parcours/pilotage-remboursement-billet.test.ts:235`, `tests/parcours/pilotage-remboursement-billet.test.ts:356`, `tests/parcours/pilotage-remboursement-billet.test.ts:369`, `e2e/recette.spec.ts:728` | vert au run 113 |
| A5 | Élevée | §87, §88, §96, §97 | Parrainage prestataire absent : Q2 à trancher d’abord | listée | `app/api/auth/register/route.ts` | — | sans objet |
| A6 | Moyenne | §15 | Profil en lecture seule. Prénom, nom, email, photo et numéro se modifient désormais à l’écran, par des routes dédiées, jamais par une écriture directe | corrigée | `fix(9.2s)` 7f8a8a11, `fix(9.2e)` 339a185c, `fix(9.2-photo)` fff118f0, `fix(9.2e-avatar)` 8d55067f ; `app/profile/page.tsx`, `app/api/account/profile/route.ts`, `app/api/account/phone/confirm/route.ts`, `app/api/account/avatar/route.ts` | `tests/parcours/compte-profil.test.ts:186`, `tests/parcours/compte-profil.test.ts:570`, `tests/parcours/compte-profil.test.ts:577`, `tests/parcours/compte-numero.test.ts:488`, `tests/parcours/compte-numero.test.ts:1042`, `tests/parcours/compte-photo.test.ts:252`, `tests/parcours/compte-photo.test.ts:491`, `tests/parcours/compte-photo.test.ts:670` | vert au run 113 |
| A7 | Moyenne | §17 | Événements populaires et proches absents. Accueil : Populaires (billets vendus sur 7 jours, gardés 60 secondes) et Près de chez vous (ville du profil ou de l’appareil, sans géolocalisation). Q4 tranchée par la consigne du lot 9 | corrigée | `fix(9.1s)` faaa81d6, `fix(9.1e)` b5e8f324 ; `app/api/events/popular/route.ts`, `components/events/HomeDiscovery.tsx`, `M/20261108000003_lot9_decouverte.sql:27` | `tests/parcours/decouverte-populaires.test.ts:157`, `tests/parcours/decouverte-populaires.test.ts:212`, `tests/parcours/decouverte-populaires.test.ts:380`, `tests/parcours/decouverte-cache.test.ts:67`, `tests/parcours/decouverte-cache.test.ts:89`, `tests/parcours/decouverte-ville.test.ts:276`, `tests/parcours/decouverte-ecrans.test.ts:317`, `tests/parcours/decouverte-ecrans.test.ts:335` | vert au run 113 |
| A8 | Moyenne | §22, §144 | WhatsApp absent, sans décision écrite : Q1 | listée | `lib/notifications/dispatcher.ts` | — | sans objet |
| A9 | Moyenne | §106, §119, §132, §133, §162 | Historique du parrainage incomplet, ROI absent | listée | `app/api/referrals/my-stats/route.ts`, `app/admin/referral/page.tsx` | — | sans objet |
| A10 | Moyenne | §83, §105 | Virement bancaire non traité, réglage fermé par défaut | listée | `docs/lot3-rapport.md:1900` | — | sans objet |
| A11 | Moyenne | §104 | Auto-parrainage et boucles sans test. Preuve ajoutée, verte dès l’écriture | preuve ajoutée | `test(8.3)[garde-fous]` 2769248 ; `tests/parcours/parrainage-gardes.test.ts` | `tests/parcours/parrainage-gardes.test.ts:90`, `tests/parcours/parrainage-gardes.test.ts:128`, `tests/parcours/parrainage-gardes.test.ts:139` | vert au run 113 |
| A12 | Moyenne | §1, §183 | Un client ne devient pas partenaire (D8, D63) | listée | `docs/lot7-rapport.md` | — | sans objet |
| A13 | Moyenne | §134 | Une erreur de lecture du journal d’audit s’affichait comme une liste vide. ErrorState et colonne Utilisateur | corrigée | `fix(8.3-A13)` 404d06a ; `app/admin/audit/page.tsx` | `tests/parcours/admin-audit.test.ts:107`, `tests/parcours/admin-audit.test.ts:180`, `tests/parcours/admin-audit.test.ts:246`, `tests/parcours/admin-audit.test.ts:277` | vert au run 113 |
| A14 | Faible | §16 | q et city de la liste publique sans test. Preuve ajoutée, verte dès l’écriture | preuve ajoutée | `test(8.3)[garde-fous]` 2769248 ; `tests/parcours/decouverte-recherche.test.ts` | `tests/parcours/decouverte-recherche.test.ts:88`, `tests/parcours/decouverte-recherche.test.ts:97`, `tests/parcours/decouverte-recherche.test.ts:111`, `tests/parcours/decouverte-recherche.test.ts:122`, `tests/parcours/decouverte-recherche.test.ts:129` | vert au run 113 |
| A15 | Faible | §32, §33 | Affichage public sans assertion. Assertions ajoutées à l’acte 4, sauf le contact de l’organisateur | preuve ajoutée | `test(8.3b)` f7d8c5d ; `e2e/recette.spec.ts` | `e2e/recette.spec.ts:487` | vert au run 113 |
| A16 | Faible | décision | Code « à régler sur place » retiré : plus d’état à encaisser au scan, fonction d’encaissement supprimée, billet impayé refusé en payment_required. Le guichet reste | corrigée | `fix(9.4-A16s)` 505d70f3, `fix(9.4-A16e)` 80df7153 ; `M/20261108000005_lot9_nettoyage.sql:21`, `app/api/controller/scan/route.ts`, `lib/scan/scan-result.ts` | `tests/parcours/nettoyage-sur-place.test.ts:99`, `tests/parcours/nettoyage-sur-place.test.ts:137`, `tests/parcours/nettoyage-sur-place.test.ts:143`, `tests/parcours/nettoyage-sur-place.test.ts:151`, `tests/parcours/nettoyage-sur-place.test.ts:165`, `tests/parcours/nettoyage-sur-place.test.ts:184` | vert au run 113 |
| A17 | Faible | §21 | Pas de liste des paiements du client. Page Mes paiements, totaux, pagination, lien vers le statut, jamais d’identifiant technique | corrigée | `fix(9.2s)` 7f8a8a11, `fix(9.2e)` 339a185c ; `app/profile/payments/page.tsx`, `app/api/account/payments/route.ts`, `M/20261108000004_lot9_compte.sql:307` | `tests/parcours/compte-paiements.test.ts:132`, `tests/parcours/compte-paiements.test.ts:233`, `tests/parcours/compte-paiements.test.ts:453`, `tests/parcours/compte-paiements.test.ts:461`, `tests/parcours/compte-paiements.test.ts:475` | vert au run 113 |
| A18 | Faible | §157 | Pas d’écran de statistiques client | listée | `app/wallet/page.tsx` | — | sans objet |
| A19 | Faible | §189 | Guides client et administration absents, pages légales à prévoir | listée | `docs/guide-organisateur-entrees.md` | — | sans objet |
| A20 | Moyenne | outillage | Instabilité de la fumée au run 92 : case forcée hors de l’écran | corrigée | `test(e2e)[run 92]` ef2b36b ; `e2e/fumee.spec.ts` | `e2e/fumee.spec.ts:91` | vert au run 113 |
| A21 | Moyenne | §190 | Suites à la racine de tests/ qui ne prouvaient rien : six supprimées, leurs cas réels portés avant (ports vus verts à la CI) | corrigée | `test(9.4-A21)[suppression]` f1ff53d4 et 3ca034a4 ; `docs/lot0-rapport.md:547`, `tests/schema/recette-matrice.test.ts` | `tests/schema/code-mort-lot9.test.ts:77` | vert au run 113 |
| A22 | Faible | design | Pages d’administration non migrées, hors du contrôle de design | listée | `tests/parcours/design-systeme.test.ts` | — | sans objet |
| A23 | Moyenne | export | Injection de formule dans l’export CSV ; statut technique affiché au refus du PDF ; statut brut à l’annulation | corrigée | `fix(8.3-A23)` 1fa3fe9 ; `lib/partner/partner-dashboard.service.ts`, `app/api/tickets/[id]/pdf/route.ts` | `tests/parcours/legacy-exports-partenaire.test.ts:221`, `tests/parcours/legacy-billet-pdf.test.ts:115` | vert au run 113 |
| A24 | Moyenne | §134, §152 | La route du journal d’audit et la RLS servaient tout ADMIN (politique réécrite au lot 9, `tests/parcours/audit-logs-rls.test.ts`, vert au run 115). Route réservée, page 403 « Réservé au superadmin », liens masqués à l’admin | corrigée | `fix(9.3-A24s)` 327e130a, `fix(9.3-A24e)` f53cb2fc, `fix(9.3-A24e-nav)` f42d687a ; `app/api/admin/audit/route.ts:18`, `M/0003_rls.sql:355` | `tests/parcours/admin-audit.test.ts:107`, `tests/parcours/admin-audit-lot9.test.ts:77`, `tests/parcours/admin-audit-lot9.test.ts:199`, `tests/parcours/admin-audit-lot9.test.ts:218`, `tests/parcours/admin-audit-lot9.test.ts:233` | vert au run 113 |
| A25 | Faible | §134 | `limit` de cette route non borné. Borné à 100, 50 par défaut pour une valeur invalide | corrigée | `fix(9.3-A25)` 565619cc ; `app/api/admin/audit/route.ts:27` | `tests/parcours/admin-audit-lot9.test.ts:107` | vert au run 113 |
| A26 | Faible | §31 | Fiche partenaire d’un événement : une panne de lecture était un 404. Panne : 500, message français, jamais une absence | corrigée | `fix(9.3-A26)` 8e0a36da ; `app/api/partner/events/[id]/route.ts:32` | `tests/parcours/pannes-absences.test.ts:148`, `tests/parcours/messages-bruts.test.ts:161` | vert au run 113 |
| A27 | Faible | §104 | Le trigger de boucle de parrainage ne couvrait pas l’UPDATE. Il couvre désormais l’UPDATE, quel que soit le rôle | corrigée | `fix(9.3-A27)` 6687b89e ; `M/20261108000001_lot9_securite.sql:567` | `tests/parcours/parrainage-boucle-update.test.ts:68`, `tests/parcours/parrainage-boucle-update.test.ts:79`, `tests/parcours/parrainage-boucle-update.test.ts:125`, `tests/parcours/parrainage-boucle-update.test.ts:136` | vert au run 113 |
| A28 | Faible | §16 | Écrans de recherche sans q ni city : filtre dans le navigateur. Le catalogue et l’accueil passent au serveur, q cherche aussi la ville | corrigée | `fix(9.1s)` faaa81d6, `fix(9.1e)` b5e8f324 ; `app/explore/page.tsx:95`, `lib/events/catalog-client.ts` | `tests/parcours/decouverte-ecrans.test.ts:95`, `tests/parcours/decouverte-ecrans.test.ts:293`, `tests/parcours/decouverte-ecrans.test.ts:309`, `tests/parcours/decouverte-recherche-lot9.test.ts:87`, `tests/parcours/decouverte-recherche-lot9.test.ts:98`, `e2e/recette.spec.ts:487` | vert au run 113 |
| A29 | Moyenne | §131 | L’alerte d’un remboursement bloqué pour solde insuffisant parlait d’un bénéficiaire incomplet | corrigée | `fix(8.3-A29)` f2334de ; `lib/notifications/catalog.ts` | `tests/parcours/notif-modeles.test.ts:504` | vert au run 113 |
| A30 | Élevée | §152, §155 | GET partner/halls/[id] sans contrôle de rôle ni de propriétaire : réservations et téléphone du partenaire lisibles par tout compte connecté quand le service est ouvert. Hors périmètre, service fermé aujourd’hui | listée | `app/api/partner/halls/[id]/route.ts` | — | sans objet |
| A31 | Moyenne | §152 | GET partner/products/[id] sans contrôle de propriétaire. Hors périmètre, service fermé | listée | `app/api/partner/products/[id]/route.ts` | — | sans objet |
| A32 | Faible | qualité | Panne présentée comme une absence, non journalisée : getEventById, getHallById, getProductById, GET orders/[id]. Désormais 500 journalisé, 404 seulement pour un objet absent | corrigée | `fix(9.3-A32)` 3796cdeb ; `lib/events/event.service.ts:291`, `lib/halls/hall.service.ts:125`, `lib/products/product.service.ts:165` | `tests/parcours/pannes-absences.test.ts:120`, `tests/parcours/pannes-absences.test.ts:129`, `tests/parcours/pannes-absences.test.ts:133`, `tests/parcours/pannes-absences.test.ts:169` | vert au run 113 |
| A33 | Moyenne | qualité | Écritures ignorées : admin/permissions POST, partner/register. Une transaction, l’échec se voit, le compte créé est retiré | corrigée | `fix(9.3-A33)` 84da7d5a ; `app/api/admin/permissions/route.ts`, `app/api/partner/register/route.ts`, `M/20261108000001_lot9_securite.sql:579`, `M/20261108000001_lot9_securite.sql:637` | `tests/parcours/ecritures-ignorees.test.ts:120`, `tests/parcours/ecritures-ignorees.test.ts:134`, `tests/parcours/ecritures-ignorees.test.ts:299`, `tests/parcours/ecritures-ignorees.test.ts:319` | vert au run 113 |
| A34 | Moyenne | qualité | Lectures ignorées : admin/communications POST, admin/pricing POST, send-otp, verify-otp, admin/users PATCH. Une panne n’est plus prise pour un résultat vide | corrigée | `fix(9.3-A34)` cca809dc ; `app/api/admin/communications/route.ts`, `app/api/admin/pricing/route.ts`, `app/api/auth/send-otp/route.ts`, `app/api/auth/verify-otp/route.ts`, `app/api/admin/users/route.ts` | `tests/parcours/lectures-ignorees.test.ts:67`, `tests/parcours/lectures-ignorees.test.ts:114`, `tests/parcours/lectures-ignorees.test.ts:161`, `tests/parcours/lectures-ignorees.test.ts:198`, `tests/parcours/lectures-ignorees.test.ts:253` | vert au run 113 |
| A35 | Faible | 8.2 i | Un refus du fournisseur SMS arrivait à l’écran : send-otp recopiait `sendResult.error`. Texte fixe, détail au journal | corrigée | `test(8.3-A35)` 02e331f, `fix(8.3-A35)` 15dc7d0 ; `app/api/auth/send-otp/route.ts` | `tests/parcours/otp-serveur.test.ts:77` | vert au run 113 |
| A36 | Faible | 8.2 i | Le refus de rembourser un billet utilisé montrait le statut technique : `ticket_refund_request` l’écrit, migration gelée, la route met un texte fixe | corrigée | `test(8.3-A36)` ef3e9fa, `fix(8.3-A36)` ffc0167 ; `app/api/partner/events/[id]/tickets/[ticketId]/refund/route.ts`, `M/20261101000005_lot3_remboursements.sql:85` | `tests/parcours/pilotage-remboursement-billet.test.ts:266` | vert au run 113 |
| A37 | Faible | design | Effet de 8.2 s : les barres fixes en bas des pages salles, menu et tables passent sous la navigation mobile. Hors périmètre, derrière interrupteurs | listée | `app/halls/[id]/page.tsx:347`, `app/restaurants/[id]/menu/page.tsx:395`, `app/restaurants/[id]/tables/page.tsx:343` | — | sans objet |
| A38 | Faible | §134 | La colonne Utilisateur montrait un identifiant tronqué. Jointure côté serveur, nom et rôle courant à l’écran | corrigée | `fix(9.3-A38s)` 9c63b516, `fix(9.3-A38e)` ee9b0966 ; `app/api/admin/audit/route.ts:34`, `app/admin/audit/page.tsx:228` | `tests/parcours/admin-audit-lot9.test.ts:136`, `tests/parcours/admin-audit-lot9.test.ts:141`, `tests/parcours/admin-audit-lot9.test.ts:150`, `tests/parcours/admin-audit-lot9.test.ts:207` | vert au run 113 |
| A39 | Moyenne | §158 | Le PDF de clôture portait « Document comptable certifie » et « Certificat de cloture ». Intitulé « Rapport de clôture », plus aucune mention de certification | corrigée | `fix(9.3-A39)` 62be3f26 ; `lib/partner/partner-dashboard.service.ts:918`, `lib/partner/partner-dashboard.service.ts:1072` | `tests/parcours/cloture-vocabulaire.test.ts:61`, `tests/parcours/cloture-vocabulaire.test.ts:66`, `tests/parcours/cloture-vocabulaire.test.ts:74` | vert au run 113 |
| A40 | Faible | outil d’essai | La route de développement ignorait le statut du webhook : un webhook en 500 rendait ok:true. Désormais 502 et message clair | corrigée | `fix(9.3-A40)` a118e370 ; `app/api/dev/samirpay/[action]/route.dev.ts:54`, `components/dev/FakePaymentPanel.tsx` | `tests/schema/essai-route-dev.test.ts:70` | vert au run 113 |
| A41 | Élevée | §36, §179 | Depuis le lot 3, un visiteur sans compte ne pouvait pas commencer un achat : le middleware refusait le devis public, la fiche affichait « Total indisponible ». Trouvée par le parcours de recette au run 99. Le devis passe sans session, le paiement reste protégé | corrigée | `test(8.3-A41)` 697f9ec, `fix(8.3-A41)` c532ca7 ; `middleware.ts:38` | `tests/parcours/finance-affichage.test.ts:80`, `e2e/recette.spec.ts:487` | vert au run 113 |
| PO3 | Moyenne | concurrence | Remboursement d’un billet sans paiement : billet avant catégorie, cycle possible avec l’annulation. Ordre unique rétabli | corrigée | `fix(9.3-PO3)` bf96b1d3 ; `M/20261108000001_lot9_securite.sql:21` | `tests/parcours/course-verrous-lot9.test.ts:186`, `tests/parcours/course-verrous-lot9.test.ts:219`, `tests/parcours/course-verrous-lot9.test.ts:444` | vert au run 113 |
| PO4 | Moyenne | concurrence | event_update et ticket_category_guard : verrou fort sur l’événement, cycle possible avec un paiement. Verrou affaibli, ordre unique | corrigée | `fix(9.3-PO4)` 31e6e613 ; `M/20261108000001_lot9_securite.sql:143`, `M/20261108000001_lot9_securite.sql:518` | `tests/parcours/course-verrous-lot9.test.ts:362`, `tests/parcours/course-verrous-lot9.test.ts:374`, `tests/parcours/course-verrous-lot9.test.ts:457` | vert au run 113 |
| PO10 | Faible | qualité | Code mort : deux modales et le service de calcul sans appelant. Supprimés | corrigée | `fix(9.4-PO10)` f1b4ed60, `fix(9.4-PO10e)` 2423f393 ; `lib/halls/hall.service.ts`, `tests/schema/code-mort-lot9.test.ts` | `tests/schema/code-mort-lot9.test.ts:57`, `tests/schema/code-mort-lot9.test.ts:62`, `tests/schema/code-mort-lot9.test.ts:67` | vert au run 113 |

## 6. Questions au client

| N° | Question |
|---|---|
| Q1 | WhatsApp : faut-il le construire, et pour quels messages ? |
| Q2 | Parrainage prestataire : quelles transactions d’un prestataire comptent ? |
| Q3 | Que recouvre « Wallet » : Apple ou Google Wallet, ou la page Portefeuille ? |
| Q4 | Tranchée par la consigne du lot 9 : Populaires selon les billets vendus sur 7 jours, proches selon la ville du profil ou de l’appareil, sans géolocalisation |
| Q5 | Personnalisation des taux par le superadmin : à construire quand ? |
| Q6 | Quels taux après le passage d’un client en Ambassadeur ? |

## 7. Cahier de recette manuelle

Ce cahier se déroule sur event-village-dev, à l’ordinateur et au téléphone. Il ne demande aucune connaissance technique. Comptez environ 3 h.

Avant de commencer, suivez le guide `docs/essai-local.md`. Il explique comment lancer l’application, créer les comptes de test, ouvrir l’application sur le téléphone, et lire les SMS simulés.

Pour chaque essai, suivez les étapes, comparez avec le résultat attendu, puis cochez OK ou Anomalie. En cas d’anomalie, notez ce que vous avez vu dans la ligne Remarque.

Quelques essais demandent une condition particulière :

- Les essais 19, 42 et 58 se font en mode simulé.
- Les essais 25, 26 et 32 se font en mode B, avec le tunnel (sections 9 et 11 du guide).
- L’essai 48 suit la section 8.7 du guide. L’essai 50 se termine 7 jours plus tard.
- Les essais 62 à 69 suivent les sections 8.8 bis et 8.12 à 8.15 du guide. L’essai 62 se fait avant l’annulation de la section 8.10, l’essai 67 après tous les autres essais de `client2`.
- L’essai 60 se fait en dernier, car il repasse en réel.

### A. Préparation

#### Essai 1. Lancer l’application et les tâches planifiées

**Appareil :** ordinateur.

**Préparation :** Le guide `docs/essai-local.md` est ouvert. Les migrations sont appliquées et le fichier de réglages est rempli (sections 3 et 4 du guide).

1. Lancez le faux SamirPay, l’application et les tâches planifiées, chacun dans sa fenêtre (section 6 du guide).
2. Ouvrez l’accueil dans le navigateur.
3. Regardez la fenêtre des tâches planifiées pendant 5 minutes.

**Résultat attendu :** L’accueil s’ouvre. Le journal des tâches défile sans erreur. La bannière « Intégrations simulées » s’affiche si vous êtes en mode simulé.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 2. Se connecter avec les comptes de test

**Appareil :** ordinateur.

**Préparation :** Les comptes de test sont créés (section 7 du guide).

1. Connectez-vous avec `superadmin`, puis déconnectez-vous.
2. Faites de même avec `partenaire`, `controleur` et `client1`.

**Résultat attendu :** Chaque compte arrive sur son espace : administration, espace partenaire, scanner, accueil.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

### B. Découverte

#### Essai 3. Voir les événements sans compte

**Appareil :** téléphone.

**Préparation :** Le téléphone ouvre l’adresse du tunnel (section 9 du guide). Vous n’êtes pas connecté.

1. Ouvrez l’accueil.
2. Touchez Explorer.

**Résultat attendu :** Les événements publiés s’affichent, avec leur prix « à partir de ». Le brouillon et l’événement en attente n’y sont pas.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 4. Chercher un événement et filtrer par ville

**Appareil :** téléphone.

**Préparation :** Vous êtes sur Explorer.

1. Tapez un mot du titre de « Concert d’essai à Dakar ».
2. Choisissez une ville dans le filtre.
3. Effacez la recherche.

**Résultat attendu :** Seuls les bons événements restent. Après effacement, la liste complète revient.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 5. Ouvrir une fiche complète

**Appareil :** ordinateur.

**Préparation :** Un événement a un programme et des informations pratiques renseignés (essai 11).

1. Ouvrez sa fiche depuis Explorer.
2. Lisez la page jusqu’en bas.

**Résultat attendu :** Programme, adresse, accès, parking, contact de l’organisateur, règles et carte sont présents. La barre d’achat reste en bas de l’écran pendant le défilement.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 6. Ouvrir l’adresse d’un événement non publié

**Appareil :** ordinateur.

**Préparation :** Compte `partenaire` : ouvrez « Atelier d’essai en brouillon » et copiez le long identifiant qui figure à la fin de l’adresse de la page.

1. Dans une fenêtre privée, sans compte, ouvrez l’adresse du site suivie de events, d’une barre oblique, puis de l’identifiant copié.

**Résultat attendu :** La page affiche « Page introuvable ». Rien du brouillon n’apparaît.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

### C. Compte client

#### Essai 7. S’inscrire : numéro, code, profil

**Appareil :** téléphone.

**Préparation :** Vous n’êtes pas connecté. Vous êtes sur la fiche d’un événement payant.

1. Ajoutez un billet et touchez Acheter.
2. Choisissez « Créer un compte client ».
3. Saisissez un numéro inventé de 9 chiffres commençant par 70 et demandez le code.
4. Lisez le code dans la fenêtre des SMS et saisissez-le.
5. Remplissez prénom, nom et mot de passe.

**Résultat attendu :** Le compte est créé. Vous revenez sur la fiche de l’événement, connecté.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 8. Mot de passe oublié

**Appareil :** téléphone.

**Préparation :** Un compte client existe, connecté sur un second appareil ou navigateur.

1. Sur la page de connexion, touchez « Mot de passe oublié » et choisissez le téléphone.
2. Saisissez le numéro, puis le code reçu.
3. Choisissez un nouveau mot de passe.
4. Rechargez la page sur le second appareil.

**Résultat attendu :** Le nouveau mot de passe est accepté. L’ancien ne marche plus. La session du second appareil est fermée.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

### D. Partenaire et événement

#### Essai 9. S’inscrire comme partenaire avec ses pièces

**Appareil :** ordinateur.

**Préparation :** Déconnecté. Un fichier PDF ou une image pour la pièce d’identité.

1. Ouvrez l’inscription partenaire.
2. Remplissez le formulaire et joignez les pièces.
3. Touchez « Envoyer mon dossier ».
4. Saisissez le code reçu, puis touchez « Vérifier le code ».

**Résultat attendu :** L’écran annonce « Dossier reçu ». Le dossier est en attente de validation.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 10. Admin : ouvrir les pièces et valider

**Appareil :** ordinateur.

**Préparation :** Compte `superadmin`. Le dossier de l’essai 9 existe.

1. Dans le tableau de bord d’administration, ouvrez l’onglet En attente.
2. Touchez Dossier sur la ligne du partenaire.
3. Ouvrez la pièce d’identité.
4. Touchez Valider, puis « Valider la candidature ».

**Résultat attendu :** La pièce s’ouvre. Le dossier quitte la file. Le partenaire reçoit un SMS et peut entrer dans son espace.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 11. Créer un événement avec 4 catégories

**Appareil :** ordinateur.

**Préparation :** Compte `partenaire`. Une image pour l’affiche.

1. Touchez « Créer un événement ». Remplissez titre, description, dates, lieu, ville, capacité et affiche.
2. Ajoutez une ligne de programme.
3. Remplissez adresse, accès, stationnement, contact et règles.
4. Créez 4 catégories : Standard (en ligne et guichet), Sur place (guichet seulement), Invitations (aucun canal), Découverte à 0 F (en ligne).
5. Lisez l’aide sous les deux cases « Vendue en ligne » et « Vendue au guichet ».
6. Touchez « Enregistrer le brouillon ».

**Résultat attendu :** Les aides sont claires (« Sur place uniquement », « Invitations seulement »). L’enregistrement réussit sans message d’erreur.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 12. Soumettre, refuser avec un motif

**Appareil :** ordinateur.

**Préparation :** Comptes `partenaire` et `superadmin`. L’événement de l’essai 11 est en brouillon.

1. Côté partenaire, touchez Soumettre.
2. Côté administration, ouvrez l’événement et refusez-le avec un motif.
3. Revenez côté partenaire.

**Résultat attendu :** Le motif du refus est visible par le partenaire. L’événement redevient un brouillon.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 13. Corriger, soumettre, valider, publier

**Appareil :** ordinateur.

**Préparation :** Suite de l’essai 12.

1. Corrigez l’événement et soumettez-le.
2. Côté administration, touchez Valider.
3. Côté partenaire, touchez Publier.
4. Ouvrez Explorer sans compte.

**Résultat attendu :** L’événement est visible par le public. Sur sa fiche, les catégories Sur place et Invitations n’apparaissent pas.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 14. Modifier la date après une vente

**Appareil :** ordinateur.

**Préparation :** Un billet de cet événement est vendu (essai 16).

1. Côté partenaire, modifiez la date de l’événement et enregistrez.
2. Attendez un passage des tâches planifiées.

**Résultat attendu :** Le client qui a un billet est prévenu dans sa cloche et par SMS.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 15. Inviter un contrôleur, permission espèces, PIN

**Appareil :** ordinateur.

**Préparation :** Compte `partenaire`, événement publié, onglet Équipe.

1. Saisissez le prénom, le nom et le téléphone d’un nouveau contrôleur.
2. Cochez l’encaissement en espèces.
3. Touchez « Inviter le contrôleur ».
4. Ouvrez l’onglet Caisse et touchez « Générer le code PIN ».
5. Notez le code, puis touchez « J’ai noté le code ».

**Résultat attendu :** Le contrôleur reçoit son code d’activation. Le PIN s’affiche une seule fois. L’écran dit ensuite qu’un code est en place.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

### E. Achat

#### Essai 16. Acheter 2 billets payants

**Appareil :** téléphone.

**Préparation :** Compte `client1`. Événement de l’essai 13.

1. Ajoutez 2 billets Standard.
2. Lisez les frais et le total, puis touchez Acheter.
3. Choisissez Wave ou Orange Money et saisissez un numéro.
4. Validez le paiement simulé (section 8.3 du guide).

**Résultat attendu :** Frais et total sont affichés avant de payer. Un SMS de confirmation s’écrit dans la fenêtre des SMS. Les 2 billets sont dans Mes billets.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 17. Vérifier les montants à 1 000 F

**Appareil :** téléphone.

**Préparation :** Un événement a une catégorie à 1 000 F.

1. Ajoutez 1 billet à 1 000 F.
2. Lisez le détail avant de payer.

**Résultat attendu :** Prix 1 000 F, frais 50 F, total 1 050 F.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 18. Refuser le paiement

**Appareil :** téléphone.

**Préparation :** Compte `client1`.

1. Lancez un achat.
2. Sur la page du paiement simulé, touchez « Refuser le paiement ».

**Résultat attendu :** Le message est clair, « Réessayer le paiement » est proposé, et aucun billet n’est créé.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 19. Fermer la page pendant l’attente

**Appareil :** téléphone.

**Préparation :** Compte `client1`. Mode simulé obligatoire.

1. Lancez un achat et fermez la page d’attente.
2. Sur l’ordinateur, validez le paiement simulé.
3. Rouvrez Mes billets.

**Résultat attendu :** Le billet est reçu malgré la page fermée.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 20. Prendre un billet gratuit

**Appareil :** téléphone.

**Préparation :** Compte `client2`. « Journée portes ouvertes d’essai ».

1. Ajoutez une Entrée libre.
2. Touchez « Réserver 1 billet gratuit ».

**Résultat attendu :** Le billet est dans Mes billets tout de suite, sans paiement.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 21. Catégorie Sur place absente en ligne

**Appareil :** téléphone.

**Préparation :** Événement de l’essai 13.

1. Ouvrez sa fiche publique.
2. Parcourez la liste des billets.

**Résultat attendu :** Ni Sur place ni Invitations n’apparaissent.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 22. Dépasser la limite par commande

**Appareil :** téléphone.

**Préparation :** Une catégorie a une limite par commande.

1. Ajoutez plus de billets que la limite.

**Résultat attendu :** L’écran empêche l’achat, avec un refus clair en français.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 23. Télécharger le PDF du billet

**Appareil :** téléphone.

**Préparation :** Un billet valide dans Mes billets.

1. Touchez le téléchargement du billet.
2. Ouvrez le fichier.

**Résultat attendu :** Le numéro du billet et la mention de la pièce d’identité sont présents. Il n’y a pas de QR.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

### F. Billet et transfert

#### Essai 24. Observer le QR

**Appareil :** téléphone.

**Préparation :** Un billet valide dans Mes billets.

1. Affichez le QR.
2. Observez-le pendant une minute.

**Résultat attendu :** Le QR change toutes les 20 secondes.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 25. Installer l’application

**Appareil :** téléphone.

**Préparation :** Mode B et tunnel (sections 9 et 11 du guide). Suivez `docs/installer-application.md`.

1. Installez l’application depuis le navigateur.
2. Ouvrez-la depuis l’écran d’accueil.

**Résultat attendu :** L’icône est sur l’écran d’accueil et l’application s’ouvre sans barre d’adresse.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 26. Billet hors ligne, la veille

**Appareil :** téléphone.

**Préparation :** Mode B. Application installée. L’événement commence dans moins de 24 h.

1. Connectez `client1` et ouvrez Mes billets avec du réseau. Attendez la mention « Disponible hors ligne ».
2. Passez en mode avion.
3. Touchez « Afficher mes billets hors ligne ».

**Résultat attendu :** Le QR reste affiché et continue de changer toutes les 20 secondes.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 27. Transférer un billet et l’accepter

**Appareil :** deux téléphones, ou téléphone et ordinateur.

**Préparation :** Comptes `client1` et `client2`.

1. Côté `client1`, touchez Transférer sur un billet et saisissez le numéro de `client2`.
2. Touchez « Envoyer le billet », puis Terminer.
3. Côté `client2`, ouvrez l’onglet des billets reçus et touchez « Accepter le billet ».

**Résultat attendu :** Le billet change de propriétaire. Il disparaît des billets valides de `client1` et apparaît chez `client2`.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 28. Présenter une capture de l’ancien QR

**Appareil :** téléphone.

**Préparation :** Faites une capture d’écran du QR avant le transfert de l’essai 27.

1. Présentez la capture au scanner du contrôleur après le transfert.

**Résultat attendu :** Le billet est refusé.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

### G. Contrôle à l’entrée

#### Essai 29. Activer le compte contrôleur

**Appareil :** téléphone.

**Préparation :** Le contrôleur de l’essai 15 a reçu son code.

1. Ouvrez le lien reçu dans le SMS.
2. Saisissez le code, puis un mot de passe et sa confirmation.
3. Touchez « Activer mon compte ».

**Résultat attendu :** Vous arrivez sur le scanner.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 30. Scanner un billet valide

**Appareil :** deux téléphones.

**Préparation :** Événement du jour (section 8.1 du guide), contrôleur affecté, `client1` a un billet.

1. Côté contrôleur, choisissez l’événement et commencez le contrôle.
2. Autorisez la caméra et visez le QR du client.

**Résultat attendu :** Écran vert plein écran, vibration courte.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 31. Rescanner le même billet

**Appareil :** deux téléphones.

**Préparation :** Suite de l’essai 30.

1. Présentez le même QR.

**Résultat attendu :** Le message dit « déjà utilisé ». La vibration est différente de celle de l’essai 30.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 32. Scanner le QR du client en mode avion

**Appareil :** deux téléphones.

**Préparation :** Mode B. Le téléphone du client est en mode avion (essai 26).

1. Présentez le QR hors ligne au contrôleur.

**Résultat attendu :** L’entrée est acceptée.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 33. Saisie manuelle avec pièce d’identité

**Appareil :** téléphone.

**Préparation :** Un billet valide non scanné. Lisez son numéro dans Mes billets.

1. Touchez « Saisie manuelle » et saisissez le numéro.
2. Touchez « Vérifier le billet ».
3. Cochez la pièce d’identité conforme.
4. Touchez « Pièce conforme, valider l’entrée ».

**Résultat attendu :** Le titulaire est affiché et l’entrée est validée.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 34. Quitter l’application en plein contrôle

**Appareil :** téléphone.

**Préparation :** Le contrôle est en cours.

1. Ouvrez le profil, puis revenez en arrière.
2. Touchez « Reprendre le contrôle ».

**Résultat attendu :** Même événement, mêmes chiffres. La caméra repart.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 35. Couper le réseau et scanner

**Appareil :** téléphone.

**Préparation :** Contrôle en cours.

1. Passez le téléphone du contrôleur en mode avion.
2. Présentez un QR.
3. Remettez le réseau.

**Résultat attendu :** Le message parle d’un incident de réseau, jamais de « billet invalide ». Le billet reste intact.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

### H. Caisse et guichet

#### Essai 36. Ouvrir la caisse et vendre 2 billets Sur place

**Appareil :** téléphone.

**Préparation :** Contrôleur avec permission espèces.

1. Ouvrez l’onglet Caisse et touchez « Ouvrir ma caisse ». Indiquez le fonds de caisse.
2. Ouvrez l’onglet Guichet.
3. Ajoutez 2 billets Sur place.
4. Saisissez le numéro de l’acheteur et validez la vente.

**Résultat attendu :** Seules les catégories vendues au guichet sont proposées. Sur place porte la mention « Sur place uniquement ». Le total vient du serveur. Le reçu part par SMS.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 37. Clôturer sans écart

**Appareil :** téléphone.

**Préparation :** Suite de l’essai 36.

1. Ouvrez l’onglet Caisse et touchez « Clôturer ma caisse ».
2. Saisissez le montant exact, puis touchez « Clôturer la caisse ».

**Résultat attendu :** Le Z de caisse est correct et affiché.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 38. Clôturer avec un écart

**Appareil :** téléphone.

**Préparation :** Une caisse ouverte. Le PIN de l’essai 15 est noté.

1. Saisissez un montant différent.
2. Touchez « Clôturer la caisse ».
3. Ajoutez une justification et le PIN.

**Résultat attendu :** L’écart calculé par le serveur s’affiche. La justification et le PIN sont exigés avant la clôture.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

### I. Pilotage

#### Essai 39. Suivre le pilotage pendant un scan

**Appareil :** ordinateur et téléphone.

**Préparation :** Compte `partenaire`, onglet Aperçu ouvert.

1. Scannez un billet sur le téléphone.
2. Regardez l’ordinateur sans recharger.

**Résultat attendu :** Les chiffres se mettent à jour seuls.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 40. Exporter les participants

**Appareil :** ordinateur.

**Préparation :** Onglet Clôture du pilotage.

1. Touchez « Exporter les participants ».
2. Ouvrez le fichier dans Excel.

**Résultat attendu :** Le fichier s’ouvre et les accents sont corrects.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 41. Lire le rapport de clôture

**Appareil :** ordinateur.

**Préparation :** Tableau de bord du partenaire.

1. Touchez Clôture sur la ligne de l’événement.
2. Lisez le rapport, puis téléchargez le PDF.

**Résultat attendu :** Ventes en ligne et espèces sont séparées. Le PDF se télécharge, s’intitule « Rapport de clôture » et ne porte aucune mention de certification.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 42. Demander un retrait

**Appareil :** ordinateur.

**Préparation :** Mode simulé. Avant les ventes, `superadmin` a mis « Délai de garde des ventes » à Désactivé, avec un motif. Le partenaire a au moins 6 000 F de ventes en ligne disponibles.

1. Ouvrez Finances dans l’espace partenaire.
2. Choisissez Wave, saisissez le numéro et 6 000 F.
3. Touchez « Recevoir le code de confirmation ».
4. Saisissez le code, puis touchez « Confirmer le retrait ».

**Résultat attendu :** Le code est demandé. Les frais sont de 60 F, soit 1 %. Le montant versé est de 5 940 F.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 43. Demander moins de 5 000 F

**Appareil :** ordinateur.

**Préparation :** Même écran.

1. Saisissez 4 999 F et poursuivez.

**Résultat attendu :** Le refus est clair : le minimum est de 5 000 F.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

### J. Annulation et remboursement

#### Essai 44. Annuler un événement

**Appareil :** ordinateur.

**Préparation :** Un événement avec des billets vendus, en ligne et au guichet.

1. Touchez « Annuler l’événement ».
2. Rédigez l’avis public et le motif interne.
3. Retapez le titre exact.
4. Touchez « Confirmer l’annulation ».

**Résultat attendu :** L’avis s’affiche sur la fiche publique et les ventes s’arrêtent.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 45. Côté client après l’annulation

**Appareil :** téléphone.

**Préparation :** Suite de l’essai 44, tâches planifiées actives.

1. Attendez un passage des tâches planifiées.
2. Ouvrez Mes billets avec le compte du client.

**Résultat attendu :** Le SMS d’annulation puis celui du remboursement partent. Le billet est marqué Remboursé.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 46. Côté espèces après l’annulation

**Appareil :** ordinateur.

**Préparation :** Suite de l’essai 44, avec une vente au guichet.

1. Ouvrez la page de l’événement annulé, côté partenaire.
2. Regardez l’avancement des remboursements.

**Résultat attendu :** Le remboursement en espèces est signalé à la charge de l’organisateur. La plateforme ne verse rien.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

### K. Notifications

#### Essai 47. Couper une préférence facultative

**Appareil :** téléphone.

**Préparation :** Compte `client1`, page des préférences de notification.

1. Coupez les SMS de rappel.
2. Déclenchez un rappel (essai 48), puis un achat.

**Résultat attendu :** Le rappel n’arrive plus par SMS. La confirmation d’achat, indispensable, arrive toujours.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 48. Rappels de la veille et de H-3

**Appareil :** téléphone.

**Préparation :** Section 8.7 du guide : événement du jour avec un début dans 3 h 20, entre 8 h et 19 h.

1. Laissez tourner les tâches planifiées, ou forcez un passage comme le guide l’indique.
2. Regardez la cloche et la fenêtre des SMS.

**Résultat attendu :** Le rappel arrive une seule fois.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

### L. Parrainage

#### Essai 49. Copier son lien et s’inscrire avec

**Appareil :** téléphone.

**Préparation :** Compte `client1`, page Portefeuille.

1. Copiez le lien de parrainage.
2. Ouvrez-le dans une fenêtre privée.
3. Vérifiez que le code est déjà rempli dans « Plus d’options ».
4. Créez un compte.
5. Revenez sur le Portefeuille de `client1`.

**Résultat attendu :** Le lien mène à l’inscription, le code est prérempli, et le filleul est rattaché : `client1` voit 1 filleul.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 50. Le filleul achète

**Appareil :** téléphone.

**Préparation :** Le filleul de l’essai 49.

1. Achetez un billet avec ce compte.
2. Revenez sur le Portefeuille de `client1`.
3. Reprenez cet essai 7 jours plus tard.

**Résultat attendu :** Une commission est En attente tout de suite, puis Disponible après le délai, qui est de 7 jours au moins.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 51. Passer un client Ambassadeur

**Appareil :** ordinateur.

**Préparation :** Compte `superadmin`, page Parrainage de l’administration.

1. Cherchez `client2` et activez le statut.
2. Lisez la mention sur les taux.

**Résultat attendu :** Le statut est visible et le rôle reste Client. La mention dit que la personnalisation des taux n’est pas disponible. Aucun bouton n’annonce une fausse sauvegarde.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

### M. Administration

#### Essai 52. Modifier un réglage et voir l’historique

**Appareil :** ordinateur.

**Préparation :** Compte `superadmin`, Réglages financiers.

1. Touchez Modifier sur un réglage.
2. Tentez d’enregistrer sans motif.
3. Ajoutez un motif et enregistrez.

**Résultat attendu :** Sans motif, rien n’est enregistré. Ensuite, valeur, auteur et motif s’affichent dans l’historique.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 53. Admin sans droit

**Appareil :** ordinateur.

**Préparation :** Compte `admin`.

1. Tentez la même modification.

**Résultat attendu :** Le refus s’affiche : « Réglage non enregistré ». La valeur ne change pas.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 54. Superviser les notifications et relancer un échec

**Appareil :** ordinateur.

**Préparation :** Compte `admin`. Une notification est en échec, ce qui suppose un refus de SMS ; sinon notez « sans objet ».

1. Ouvrez Notifications et filtrez sur les échecs.
2. Ouvrez le détail et touchez Relancer, puis confirmez.

**Résultat attendu :** La ligne est relancée puis envoyée.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 55. Suspendre un partenaire

**Appareil :** ordinateur.

**Préparation :** Compte `superadmin`. Partenaire connecté dans une autre fenêtre.

1. Ouvrez Utilisateurs et cherchez le partenaire.
2. Touchez Suspendre.
3. Rechargez la fenêtre du partenaire.

**Résultat attendu :** Il est déconnecté et ne peut plus revenir.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 56. Rapprochement financier

**Appareil :** ordinateur.

**Préparation :** Compte `superadmin`, page Finances de l’administration, après les essais E et J.

1. Lisez les totaux.
2. Comparez-les à vos achats et remboursements.

**Résultat attendu :** Les totaux sont cohérents avec les essais. La vente en espèces n’y figure pas.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 57. Journal d’activité

**Appareil :** ordinateur.

**Préparation :** Compte `superadmin`, page Journal.

1. Filtrez par action.
2. Ouvrez le détail d’une ligne.
3. Déconnectez-vous et reconnectez-vous avec `admin`. Cherchez le Journal dans le menu.

**Résultat attendu :** Les actions sensibles sont listées, avec le nom de l’utilisateur, son rôle, la date et les anciennes et nouvelles valeurs. Avec `admin`, le Journal n’est pas proposé : il est réservé au superadmin.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

### N. Ajouts du lot 8

#### Essai 58. Relancer un remboursement bloqué

**Appareil :** ordinateur.

**Préparation :** Mode simulé, faux SamirPay lancé, un billet payé en ligne. Ouvrez une fenêtre PowerShell et collez la commande ci-dessous telle quelle : elle vide le solde du faux SamirPay. C’est la seule commande de ce cahier.

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4010/__test/samirpay/balance -ContentType application/json -Body '{"solde":0}'
```

1. Côté partenaire, remboursez ce billet (essai 59).
2. Dans PowerShell, collez la même commande en remplaçant 0 par 50000000.
3. Compte `superadmin`, page Finances, section « Remboursements à reprendre ».
4. Touchez « Relancer le remboursement », puis confirmez.

**Résultat attendu :** La ligne donne le motif en français : solde insuffisant. Après la relance, « Relance envoyée » s’affiche, la ligne quitte la liste et le billet devient Remboursé.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 59. Rembourser un billet depuis le pilotage

**Appareil :** ordinateur.

**Préparation :** Compte `partenaire`, onglet Ventes. Le numéro d’un billet payé en ligne.

1. Saisissez le numéro et touchez « Rechercher le billet ».
2. Lisez la fiche : montant et mode de remboursement.
3. Touchez « Rembourser ce billet » et donnez un motif.
4. Confirmez avec « Rembourser le client ».

**Résultat attendu :** Deux confirmations sont demandées, et « Revenir à la fiche » permet de renoncer. Le billet est ensuite remboursé.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 60. Retour en réel : un remboursement simulé reste bloqué

**Appareil :** ordinateur.

**Préparation :** À faire seulement en fin de campagne. Un billet payé en simulé existe. Suivez « Pour passer de simulé à réel », section 5 du guide.

1. Une fois en réel, remboursez ce billet.
2. Compte `superadmin`, page Finances, section « Remboursements à reprendre ».

**Résultat attendu :** Le remboursement ne part pas. Le motif affiché est « opération créée en mode simulé : aucun versement ». Aucun argent ne bouge.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 61. Catégorie Invitations seulement : aucune vente

**Appareil :** ordinateur et téléphone.

**Préparation :** Une catégorie sans aucun canal (essai 11).

1. Cherchez-la sur la fiche publique.
2. Côté contrôleur, cherchez-la dans l’onglet Guichet.

**Résultat attendu :** Elle n’apparaît ni en ligne ni au guichet. Elle se distribue seulement par l’onglet Invitations (essai 62).

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

### O. Ajouts du lot 9

#### Essai 62. Envoyer des invitations

**Appareil :** ordinateur.

**Préparation :** Compte `partenaire`, « Essai du jour », onglet Invitations (section 8.8 bis du guide). L’inscription de la section 8.6 est terminée.

1. Choisissez la catégorie « Entrée » et 1 billet par numéro.
2. Dans la zone des numéros, saisissez : le numéro du compte créé en 8.6, celui de `client2`, et un numéro inventé qui commence par 70.
3. Touchez « Envoyer les invitations », puis Confirmer.
4. Ouvrez l’onglet Ventes, puis, dans la fenêtre des SMS, attendez le passage suivant des tâches planifiées.

**Résultat attendu :** Le bandeau « Invitations envoyées » s’affiche. L’historique porte trois lignes, numéros masqués, à 0 F, statut « Envoyée ». Le stock baisse de 3 et l’onglet Ventes compte 3 dans la colonne Invitations. Trois SMS partent, avec un lien vers Mes billets et aucun code.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 63. Recevoir une invitation sans compte

**Appareil :** téléphone.

**Préparation :** Le numéro inventé de l’essai 62. Une fenêtre de navigation privée.

1. Créez un compte avec ce numéro : saisissez le code reçu, puis prénom, nom et mot de passe.
2. Ouvrez Mes billets, onglet Reçus.
3. Touchez « Accepter le billet », puis confirmez.
4. Côté contrôleur, en Saisie manuelle, entrez le numéro de ce billet, lu dans Mes billets.

**Résultat attendu :** L’expéditeur affiché est « L’organisateur de l’événement ». Après acceptation, le billet est dans Mes billets. Le contrôleur voit l’écran vert.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 64. Voir les événements Populaires

**Appareil :** ordinateur.

**Préparation :** Compte `client1`, accueil. Un billet a été vendu dans les 7 derniers jours (section 8.14 du guide).

1. Regardez la section Populaires.
2. Attendez une minute et rechargez.

**Résultat attendu :** La section montre les événements qui ont vendu des billets depuis 7 jours, les plus vendus d’abord. Les invitations ne comptent pas. Sans vente récente, la section est absente : c’est normal.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 65. Choisir sa ville

**Appareil :** ordinateur et téléphone.

**Préparation :** Compte `client1`, accueil. Puis une fenêtre de navigation privée, sans compte.

1. Dans « Votre ville », choisissez Dakar.
2. Déconnectez-vous puis reconnectez-vous.
3. Dans la fenêtre privée, choisissez une ville et rechargez la page.

**Résultat attendu :** Les événements de Dakar s’affichent, sans que le navigateur demande votre position. La ville reste après la reconnexion. Sans compte, elle reste aussi, mais seulement dans ce navigateur.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 66. Modifier prénom, nom et email

**Appareil :** téléphone.

**Préparation :** Compte `client1`, page Mon profil.

1. Changez le prénom et l’email, puis touchez « Enregistrer le profil ».
2. Déconnectez-vous et reconnectez-vous avec le nouvel email.

**Résultat attendu :** Le nouveau prénom et le nouvel email s’affichent. La connexion par le nouvel email fonctionne, celle par l’ancien non. Le numéro de téléphone continue de fonctionner.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 67. Changer de numéro

**Appareil :** téléphone.

**Préparation :** Compte `client2`, page Mon profil. À faire en dernier des essais de ce compte : section 8.15 du guide.

1. Touchez « Changer de numéro » et saisissez un numéro inventé qui commence par 70.
2. Touchez « Recevoir le code » et saisissez le code reçu sur le nouveau numéro.
3. Touchez Confirmer.
4. Rechargez la page sur un autre navigateur connecté au même compte.

**Résultat attendu :** Le nouveau numéro s’affiche et les billets restent au compte. Un SMS part vers l’ancien numéro. L’autre navigateur se ferme au plus tard dans l’heure.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 68. Mettre une photo de profil

**Appareil :** téléphone.

**Préparation :** Compte `client1`, page Mon profil. Une image JPEG, PNG ou WebP de 2 Mo au plus.

1. Touchez « Choisir une photo » et choisissez l’image.
2. Choisissez une deuxième photo.
3. Essayez un fichier texte renommé en .jpg.
4. Touchez « Supprimer la photo », puis confirmez.

**Résultat attendu :** La photo s’affiche sur la page et dans la navigation. La seconde remplace la première. Le fichier texte est refusé, « Format non pris en charge », et ne change pas la photo. Après suppression, les initiales reviennent.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

#### Essai 69. Consulter Mes paiements

**Appareil :** téléphone.

**Préparation :** Compte `client1`, page Mon profil, lien Mes paiements (section 8.12 du guide).

1. Lisez la liste.
2. Ouvrez une ligne.
3. Reconnectez-vous avec `client2` et ouvrez Mes paiements.

**Résultat attendu :** Une ligne par paiement, du plus récent au plus ancien, avec l’événement, la date, l’opérateur, le montant et un statut en français. Les cartes Total payé et Total remboursé portent sur tous les paiements. Une ligne mène à la page de statut du paiement. Le compte `client2` voit « Aucun paiement pour le moment » s’il n’a que des billets gratuits. Aucun identifiant technique ne s’affiche.

- [ ] OK
- [ ] Anomalie

Remarque : ______________________________

