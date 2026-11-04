# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: perf.spec.ts >> Scanner : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages)
- Location: e2e/perf.spec.ts:372:9

# Error details

```
Error: [e2e] état de connexion absent pour le rôle « contrôleur (démonstration) » (.auth/controleur.json) : la phase de connexion (e2e/auth.setup.ts) a échoué pour ce rôle.
```

# Test source

```ts
  1  | /**
  2  |  * Lot 5.1 — comptes utilisés par Playwright et leur état de connexion (storageState dans `.auth/`).
  3  |  *  - comptes de démonstration (seed:demo) : captures d'écran ;
  4  |  *  - comptes du seed de test (seed:test) : test de fumée, indépendant des données de démonstration ;
  5  |  *    lot 7 (D80) : second client et contrôleur A, pour le projet terrain et la fumée prolongée.
  6  |  * Le mot de passe vient des constantes de fixtures (aucun mot de passe littéral, cf.
  7  |  * tests/schema/secrets-codes-en-dur.test.ts).
  8  |  */
  9  | import fs from 'node:fs';
  10 | import path from 'node:path';
  11 | import { FIXTURE_USERS, TEST_PASSWORD } from '../../tests/helpers/fixture-data';
  12 | import { readDemoIds, type DemoAccountKey } from './demo-ids';
  13 | 
  14 | export { TEST_PASSWORD };
  15 | 
  16 | export const AUTH_DIR = path.resolve(process.cwd(), '.auth');
  17 | 
  18 | export type RoleKey =
  19 |     | 'organisateur' | 'admin' | 'client' | 'controleur'
  20 |     | 'fumee-organisateur' | 'fumee-superadmin' | 'fumee-client'
  21 |     | 'fumee-client-bis' | 'fumee-controleur';
  22 | 
  23 | export interface RoleSpec {
  24 |     key: RoleKey;
  25 |     libelle: string;
  26 |     source: 'demonstration' | 'fixtures';
  27 |     /** Page d'arrivée attendue après la connexion (redirection par rôle). */
  28 |     arrivee: RegExp;
  29 |     email: () => string;
  30 | }
  31 | 
  32 | function demoEmail(key: DemoAccountKey): () => string {
  33 |     return () => readDemoIds().accounts[key].email;
  34 | }
  35 | 
  36 | export const ROLES: readonly RoleSpec[] = [
  37 |     { key: 'organisateur', libelle: 'organisateur (démonstration)', source: 'demonstration', arrivee: /\/partner(\/|$)/, email: demoEmail('organisateur') },
  38 |     { key: 'admin', libelle: 'administrateur (démonstration, events.read et events.write)', source: 'demonstration', arrivee: /\/admin(\/|$)/, email: demoEmail('admin') },
  39 |     { key: 'client', libelle: 'client (démonstration)', source: 'demonstration', arrivee: /^\/$/, email: demoEmail('client') },
  40 |     { key: 'controleur', libelle: 'contrôleur (démonstration)', source: 'demonstration', arrivee: /\/controller\/scanner/, email: demoEmail('controleur') },
  41 |     { key: 'fumee-organisateur', libelle: 'organisateur A (seed de test)', source: 'fixtures', arrivee: /\/partner(\/|$)/, email: () => FIXTURE_USERS.PARTNER_A.email },
  42 |     { key: 'fumee-superadmin', libelle: 'superadmin (seed de test)', source: 'fixtures', arrivee: /\/admin(\/|$)/, email: () => FIXTURE_USERS.SUPERADMIN.email },
  43 |     { key: 'fumee-client', libelle: 'client (seed de test)', source: 'fixtures', arrivee: /^\/$/, email: () => FIXTURE_USERS.CLIENT.email },
  44 |     // Lot 7 (décision D80) : destinataire du transfert de la fumée prolongée et porteur des billets mesurés du
  45 |     // projet terrain (CLIENT_BIS) ; contrôleur des projets terrain et de la fumée prolongée (CONTROLLER_A).
  46 |     { key: 'fumee-client-bis', libelle: 'second client (seed de test)', source: 'fixtures', arrivee: /^\/$/, email: () => FIXTURE_USERS.CLIENT_BIS.email },
  47 |     { key: 'fumee-controleur', libelle: 'contrôleur A (seed de test)', source: 'fixtures', arrivee: /\/controller\/scanner/, email: () => FIXTURE_USERS.CONTROLLER_A.email },
  48 | ];
  49 | 
  50 | export function roleSpec(key: RoleKey): RoleSpec {
  51 |     const spec = ROLES.find((r) => r.key === key);
  52 |     if (!spec) throw new Error(`[e2e] rôle inconnu : ${key}`);
  53 |     return spec;
  54 | }
  55 | 
  56 | export function storageStatePath(key: RoleKey): string {
  57 |     return path.join(AUTH_DIR, `${key}.json`);
  58 | }
  59 | 
  60 | /** Chemin de l'état de connexion ; erreur explicite si la connexion du rôle n'a pas abouti. */
  61 | export function requireStorageState(key: RoleKey): string {
  62 |     const file = storageStatePath(key);
  63 |     if (!fs.existsSync(file)) {
> 64 |         throw new Error(
     |               ^ Error: [e2e] état de connexion absent pour le rôle « contrôleur (démonstration) » (.auth/controleur.json) : la phase de connexion (e2e/auth.setup.ts) a échoué pour ce rôle.
  65 |             `[e2e] état de connexion absent pour le rôle « ${roleSpec(key).libelle} » (${path.relative(process.cwd(), file)}) : ` +
  66 |             'la phase de connexion (e2e/auth.setup.ts) a échoué pour ce rôle.',
  67 |         );
  68 |     }
  69 |     return file;
  70 | }
  71 | 
  72 | /** Numéro de paiement (9 chiffres SamirPay) du client de la fumée : son numéro de compte du seed de test. */
  73 | export function fumeePayerPhone(): string {
  74 |     return FIXTURE_USERS.CLIENT.phone.replace(/^\+221/, '');
  75 | }
  76 | 
```