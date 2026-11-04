# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.setup.ts >> connexion : administrateur (démonstration, events.read et events.write)
- Location: e2e/auth.setup.ts:26:10

# Error details

```
Error: [e2e] .e2e-captures/demo-ids.json absent : « npm run seed:demo » n'a pas abouti (journal e2e-seed.log). Les écrans qui dépendent des données de démonstration ne peuvent pas être capturés.
```

# Test source

```ts
  1  | /**
  2  |  * Lot 5.1 — identifiants du seed de démonstration (tests/seed/seed-demo.ts), lus par les specs.
  3  |  * Le fichier est écrit dans `.e2e-captures/` (ignoré par git). Module pur : aucun client Supabase.
  4  |  * Lot 6 (contrat P1) : version 2, avec les lignes de boîte d'envoi de la supervision admin
  5  |  * (`notifications`) et le transfert entrant du client de démonstration (`transfers`).
  6  |  */
  7  | import fs from 'node:fs';
  8  | import path from 'node:path';
  9  | 
  10 | export const E2E_OUTPUT_DIR = path.resolve(process.cwd(), '.e2e-captures');
  11 | export const DEMO_IDS_FILE = path.join(E2E_OUTPUT_DIR, 'demo-ids.json');
  12 | export const CAPTURES_DIR = path.join(E2E_OUTPUT_DIR, 'captures');
  13 | export const RESULTS_DIR = path.join(E2E_OUTPUT_DIR, 'results');
  14 | 
  15 | export const DEMO_IDS_VERSION = 2;
  16 | 
  17 | export const DEMO_ACCOUNT_KEYS = [
  18 |     'organisateur', 'organisateur2', 'organisateur3', 'admin', 'client', 'controleur', 'controleur2', 'controleur3',
  19 | ] as const;
  20 | export type DemoAccountKey = typeof DEMO_ACCOUNT_KEYS[number];
  21 | 
  22 | export const DEMO_EVENT_KEYS = [
  23 |     'ceSoir', 'publie', 'publieComplet', 'suspendu', 'annule', 'annuleSansVente', 'termine', 'termine2',
  24 |     'valide', 'enAttente', 'brouillon', 'refuse',
  25 | ] as const;
  26 | export type DemoEventKey = typeof DEMO_EVENT_KEYS[number];
  27 | 
  28 | export interface DemoAccount {
  29 |     email: string;
  30 |     userId: string;
  31 |     firstName: string;
  32 |     lastName: string;
  33 |     partnerId?: string;
  34 | }
  35 | 
  36 | export interface DemoEvent {
  37 |     id: string;
  38 |     title: string;
  39 |     status: string;
  40 |     organizer: DemoAccountKey;
  41 | }
  42 | 
  43 | export interface DemoIds {
  44 |     version: typeof DEMO_IDS_VERSION;
  45 |     generatedAt: string;
  46 |     supabaseUrl: string;
  47 |     accounts: Record<DemoAccountKey, DemoAccount>;
  48 |     events: Record<DemoEventKey, DemoEvent>;
  49 |     /** Tous les événements du seed de démonstration, dans l'ordre de création. */
  50 |     allEvents: DemoEvent[];
  51 |     tickets: { clientValide: string; clientUtilise: string };
  52 |     /**
  53 |      * Lot 6 : lignes de notification_outbox de la page admin « Notifications » : FAILED après 5 tentatives
  54 |      * (détail avec « Relancer »), SENT, et journal d'un code à usage unique (le code n'est jamais stocké).
  55 |      */
  56 |     notifications: { failedId: string; sentId: string; otpLogId: string };
  57 |     /** Lot 6 : transfert PENDING vers le numéro vérifié du client de démonstration (onglet « Reçus »). */
  58 |     transfers: { incomingId: string };
  59 | }
  60 | 
  61 | const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  62 | 
  63 | export function writeDemoIds(ids: DemoIds): void {
  64 |     fs.mkdirSync(E2E_OUTPUT_DIR, { recursive: true });
  65 |     fs.writeFileSync(DEMO_IDS_FILE, `${JSON.stringify(ids, null, 2)}\n`, 'utf8');
  66 | }
  67 | 
  68 | let cached: DemoIds | null = null;
  69 | 
  70 | /** Lit et valide le fichier ; erreur explicite s'il manque (seed de démonstration non abouti). */
  71 | export function readDemoIds(): DemoIds {
  72 |     if (cached) return cached;
  73 |     if (!fs.existsSync(DEMO_IDS_FILE)) {
> 74 |         throw new Error(
     |               ^ Error: [e2e] .e2e-captures/demo-ids.json absent : « npm run seed:demo » n'a pas abouti (journal e2e-seed.log). Les écrans qui dépendent des données de démonstration ne peuvent pas être capturés.
  75 |             `[e2e] ${path.relative(process.cwd(), DEMO_IDS_FILE)} absent : « npm run seed:demo » n'a pas abouti ` +
  76 |             '(journal e2e-seed.log). Les écrans qui dépendent des données de démonstration ne peuvent pas être capturés.',
  77 |         );
  78 |     }
  79 |     const parsed = JSON.parse(fs.readFileSync(DEMO_IDS_FILE, 'utf8')) as Partial<DemoIds>;
  80 |     if (parsed.version !== DEMO_IDS_VERSION) {
  81 |         throw new Error(`[e2e] demo-ids.json : version ${String(parsed.version)} au lieu de ${DEMO_IDS_VERSION} (relancez seed:demo).`);
  82 |     }
  83 |     const missing = [
  84 |         ...DEMO_ACCOUNT_KEYS.filter((k) => !parsed.accounts?.[k]?.email).map((k) => `accounts.${k}`),
  85 |         ...DEMO_EVENT_KEYS.filter((k) => !parsed.events?.[k]?.id).map((k) => `events.${k}`),
  86 |         ...(['failedId', 'sentId', 'otpLogId'] as const)
  87 |             .filter((k) => !UUID_RE.test(String(parsed.notifications?.[k] ?? ''))).map((k) => `notifications.${k}`),
  88 |         ...(UUID_RE.test(String(parsed.transfers?.incomingId ?? '')) ? [] : ['transfers.incomingId']),
  89 |     ];
  90 |     if (missing.length > 0) throw new Error(`[e2e] demo-ids.json incomplet : ${missing.join(', ')}.`);
  91 |     cached = parsed as DemoIds;
  92 |     return cached;
  93 | }
  94 | 
```