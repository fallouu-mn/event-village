# Tests Event Village — fondations (lot 0)

## Règles

- **Jamais le projet distant.** Tous les tests tournent sur une instance Supabase locale.
  `tests/helpers/env.ts` est chargé avant chaque suite et refuse de démarrer si
  `NEXT_PUBLIC_SUPABASE_URL` n'est pas `localhost` / `127.0.0.1`, si une URL de service
  externe (SamirPay, MTarget) sort de la machine, ou si une vraie clé Resend est présente.
  Les variables Supabase sont gelées pour toute la durée du processus.
- **Aucune requête réseau.** SMS, email et SamirPay passent par des faux adaptateurs
  (`tests/fakes`) qui enregistrent les appels pour assertion.
- **Aucun UUID codé en dur.** Les identifiants viennent de `tests/helpers/fixtures.ts`
  (`loadFixtures()`, `signInAs()`), alimentés par le seed de test.

## Mise en route locale

```bash
npx supabase start            # nécessite Docker Desktop
npx supabase db reset         # toutes les migrations depuis zéro + supabase/seed.sql
cp .env.test.example .env.test   # puis reporter ANON_KEY / SERVICE_ROLE_KEY de `npx supabase status`
npm run seed:test             # comptes, partenaires, événements et catégories de test (idempotent)
npm test                      # toutes les suites de tests/, une par processus, récapitulatif + total
```

Autres commandes :

- `npm run test:security` — suites de `tests/security/` (vide pour l'instant).
- `node scripts/run-tests.mjs --filter scan` — sous-ensemble par nom.
- `node scripts/run-tests.mjs tests/samirpay-contrat.test.ts` — une suite précise.
- `npm run verify` — typecheck → lint → test → build, avec `.env.test` chargé.

Les sorties brutes de chaque suite sont conservées dans `.test-logs/` (ignoré par git).

## Suites héritées

Les 31 suites écrites avant le lot 0 ont été mises en quarantaine puis soldées lot par lot. Le lot 8 a supprimé les 26
dernières et `tests/legacy/` : chaque cas utile a été porté vers une suite moderne, sur les fixtures, ou noté pour le lot
du module concerné. Le tableau ligne par ligne est dans `docs/lot8-rapport.md`. L'inventaire d'origine reste dans
`docs/lot0-inventaire-suites.md`, pour l'histoire seulement.

## Fixtures (après `npm run seed:test`)

| Clé | Rôle(s) | Email |
|---|---|---|
| CLIENT | CLIENT | client@test.eventvillage.local |
| CLIENT_BIS | CLIENT (tests d'isolation) | client-bis@test.eventvillage.local |
| PARTNER_A | CLIENT, PARTENAIRE (validé) | partner-a@test.eventvillage.local |
| PARTNER_B | CLIENT, PARTENAIRE (validé) | partner-b@test.eventvillage.local |
| CONTROLLER_A | CLIENT, CONTROLEUR (affecté à A_PUBLIE, espèces autorisées) | controller-a@test.eventvillage.local |
| ADMIN | CLIENT, ADMIN | admin@test.eventvillage.local |
| SUPERADMIN | CLIENT, SUPERADMIN | superadmin@test.eventvillage.local |

Mot de passe commun : `TEST_PASSWORD` dans `tests/helpers/fixtures.ts`.

Événements : `A_PUBLIE` (Standard 5 000 F × 10, VIP 15 000 F × 3), `A_BROUILLON`, `A_PASSE`
(date passée, encore PUBLIE), `B_PUBLIE`.

## Faux adaptateurs

```ts
import { getFakes, resetFakes } from './fakes';

const { sms, email, payment } = getFakes();
payment.initMode = 'failed-body';                 // 'success' | 'failed-body' | 'throw'
payment.setTransactionStatus(orderId, 'success'); // statut renvoyé par checkTransactionStatus
const hook = payment.buildWebhook({ order_id: orderId, status: 'success', signed: false });
// hook.body / hook.headers / hook.formData → à passer à POST /api/webhooks/samirpay
sms.messagesTo('+221700000001');                  // SMS enregistrés
```

Le schéma de signature des webhooks simulés est provisoire ; il sera aligné sur la
documentation SamirPay au lot 2 avec la vérification côté serveur.
