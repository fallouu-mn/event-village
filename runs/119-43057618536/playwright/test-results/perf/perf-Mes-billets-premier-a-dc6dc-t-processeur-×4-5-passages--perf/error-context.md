# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: perf.spec.ts >> Mes billets : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages)
- Location: e2e/perf.spec.ts:374:9

# Error details

```
Error: [e2e] état de connexion absent pour le rôle « client (démonstration) » (.auth/client.json) : la phase de connexion (e2e/auth.setup.ts) a échoué pour ce rôle.
```

# Test source

```ts
  1  | /**
  2  |  * Lot 5.1 — comptes utilisés par Playwright et leur état de connexion (storageState dans `.auth/`).
  3  |  *  - comptes de démonstration (seed:demo) : captures d'écran ;
  4  |  *  - comptes du seed de test (seed:test) : test de fumée, indépendant des données de démonstration ;
  5  |  *    lot 7 (D80) : second client et contrôleur A, pour le projet terrain et la fumée prolongée ;
  6  |  *  - lot 7 (vague F, E5) : partenaire « premiers pas » du seed de démonstration (VALIDE, aucun événement), pour
  7  |  *    la capture de la première utilisation.
  8  |  * Le mot de passe vient des constantes de fixtures (aucun mot de passe littéral, cf.
  9  |  * tests/schema/secrets-codes-en-dur.test.ts).
  10 |  */
  11 | import fs from 'node:fs';
  12 | import path from 'node:path';
  13 | import { FIXTURE_USERS, TEST_PASSWORD } from '../../tests/helpers/fixture-data';
  14 | import { readDemoIds, type DemoAccountKey } from './demo-ids';
  15 | 
  16 | export { TEST_PASSWORD };
  17 | 
  18 | export const AUTH_DIR = path.resolve(process.cwd(), '.auth');
  19 | 
  20 | export type RoleKey =
  21 |     | 'organisateur' | 'admin' | 'client' | 'controleur' | 'partenaire-premiers-pas'
  22 |     | 'fumee-organisateur' | 'fumee-superadmin' | 'fumee-client'
  23 |     | 'fumee-client-bis' | 'fumee-controleur';
  24 | 
  25 | export interface RoleSpec {
  26 |     key: RoleKey;
  27 |     libelle: string;
  28 |     source: 'demonstration' | 'fixtures';
  29 |     /** Page d'arrivée attendue après la connexion (redirection par rôle). */
  30 |     arrivee: RegExp;
  31 |     email: () => string;
  32 | }
  33 | 
  34 | function demoEmail(key: DemoAccountKey): () => string {
  35 |     return () => readDemoIds().accounts[key].email;
  36 | }
  37 | 
  38 | export const ROLES: readonly RoleSpec[] = [
  39 |     { key: 'organisateur', libelle: 'organisateur (démonstration)', source: 'demonstration', arrivee: /\/partner(\/|$)/, email: demoEmail('organisateur') },
  40 |     { key: 'admin', libelle: 'administrateur (démonstration, events.read et events.write)', source: 'demonstration', arrivee: /\/admin(\/|$)/, email: demoEmail('admin') },
  41 |     { key: 'client', libelle: 'client (démonstration)', source: 'demonstration', arrivee: /^\/$/, email: demoEmail('client') },
  42 |     { key: 'controleur', libelle: 'contrôleur (démonstration)', source: 'demonstration', arrivee: /\/controller\/scanner/, email: demoEmail('controleur') },
  43 |     { key: 'partenaire-premiers-pas', libelle: 'partenaire « premiers pas » (démonstration, aucun événement)', source: 'demonstration', arrivee: /\/partner(\/|$)/, email: demoEmail('partenaireNeuf') },
  44 |     { key: 'fumee-organisateur', libelle: 'organisateur A (seed de test)', source: 'fixtures', arrivee: /\/partner(\/|$)/, email: () => FIXTURE_USERS.PARTNER_A.email },
  45 |     { key: 'fumee-superadmin', libelle: 'superadmin (seed de test)', source: 'fixtures', arrivee: /\/admin(\/|$)/, email: () => FIXTURE_USERS.SUPERADMIN.email },
  46 |     { key: 'fumee-client', libelle: 'client (seed de test)', source: 'fixtures', arrivee: /^\/$/, email: () => FIXTURE_USERS.CLIENT.email },
  47 |     // Lot 7 (décision D80) : destinataire du transfert de la fumée prolongée et porteur des billets mesurés du
  48 |     // projet terrain (CLIENT_BIS) ; contrôleur des projets terrain et de la fumée prolongée (CONTROLLER_A).
  49 |     { key: 'fumee-client-bis', libelle: 'second client (seed de test)', source: 'fixtures', arrivee: /^\/$/, email: () => FIXTURE_USERS.CLIENT_BIS.email },
  50 |     { key: 'fumee-controleur', libelle: 'contrôleur A (seed de test)', source: 'fixtures', arrivee: /\/controller\/scanner/, email: () => FIXTURE_USERS.CONTROLLER_A.email },
  51 | ];
  52 | 
  53 | export function roleSpec(key: RoleKey): RoleSpec {
  54 |     const spec = ROLES.find((r) => r.key === key);
  55 |     if (!spec) throw new Error(`[e2e] rôle inconnu : ${key}`);
  56 |     return spec;
  57 | }
  58 | 
  59 | export function storageStatePath(key: RoleKey): string {
  60 |     return path.join(AUTH_DIR, `${key}.json`);
  61 | }
  62 | 
  63 | /** Chemin de l'état de connexion ; erreur explicite si la connexion du rôle n'a pas abouti. */
  64 | export function requireStorageState(key: RoleKey): string {
  65 |     const file = storageStatePath(key);
  66 |     if (!fs.existsSync(file)) {
> 67 |         throw new Error(
     |               ^ Error: [e2e] état de connexion absent pour le rôle « client (démonstration) » (.auth/client.json) : la phase de connexion (e2e/auth.setup.ts) a échoué pour ce rôle.
  68 |             `[e2e] état de connexion absent pour le rôle « ${roleSpec(key).libelle} » (${path.relative(process.cwd(), file)}) : ` +
  69 |             'la phase de connexion (e2e/auth.setup.ts) a échoué pour ce rôle.',
  70 |         );
  71 |     }
  72 |     return file;
  73 | }
  74 | 
  75 | /** Numéro de paiement (9 chiffres SamirPay) du client de la fumée : son numéro de compte du seed de test. */
  76 | export function fumeePayerPhone(): string {
  77 |     return FIXTURE_USERS.CLIENT.phone.replace(/^\+221/, '');
  78 | }
  79 | 
```