# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.setup.ts >> connexion : organisateur (démonstration)
- Location: e2e/auth.setup.ts:26:10

# Error details

```
Error: [e2e] .e2e-captures/demo-ids.json absent : « npm run seed:demo » n'a pas abouti (journal e2e-seed.log). Les écrans qui dépendent des données de démonstration ne peuvent pas être capturés.
```

# Test source

```ts
  1   | /**
  2   |  * Lot 5.1 — identifiants du seed de démonstration (tests/seed/seed-demo.ts), lus par les specs.
  3   |  * Le fichier est écrit dans `.e2e-captures/` (ignoré par git). Module pur : aucun client Supabase.
  4   |  * Lot 6 (contrat P1) : version 2, avec les lignes de boîte d'envoi de la supervision admin
  5   |  * (`notifications`) et le transfert entrant du client de démonstration (`transfers`).
  6   |  * Lot 7 (contrat 11.1, fix(7.6)) : version 3, avec le partenaire « premiers pas » (`accounts.partenaireNeuf`),
  7   |  * l'événement « la veille » (`events.veille`, début ≈ 20 h après le seed), le billet du client dans la fenêtre
  8   |  * hors ligne (`tickets.clientVeille`), le billet de la saisie manuelle (`tickets.manualLookup`) et les paiements
  9   |  * du client en attente, réussi et échoué (`payments`).
  10  |  */
  11  | import fs from 'node:fs';
  12  | import path from 'node:path';
  13  | 
  14  | export const E2E_OUTPUT_DIR = path.resolve(process.cwd(), '.e2e-captures');
  15  | export const DEMO_IDS_FILE = path.join(E2E_OUTPUT_DIR, 'demo-ids.json');
  16  | export const CAPTURES_DIR = path.join(E2E_OUTPUT_DIR, 'captures');
  17  | export const RESULTS_DIR = path.join(E2E_OUTPUT_DIR, 'results');
  18  | 
  19  | export const DEMO_IDS_VERSION = 3;
  20  | 
  21  | export const DEMO_ACCOUNT_KEYS = [
  22  |     'organisateur', 'organisateur2', 'organisateur3', 'admin', 'client', 'controleur', 'controleur2', 'controleur3',
  23  |     'partenaireNeuf',
  24  | ] as const;
  25  | export type DemoAccountKey = typeof DEMO_ACCOUNT_KEYS[number];
  26  | 
  27  | export const DEMO_EVENT_KEYS = [
  28  |     'ceSoir', 'publie', 'publieComplet', 'suspendu', 'annule', 'annuleSansVente', 'termine', 'termine2',
  29  |     'valide', 'enAttente', 'brouillon', 'refuse', 'veille',
  30  | ] as const;
  31  | export type DemoEventKey = typeof DEMO_EVENT_KEYS[number];
  32  | 
  33  | export interface DemoAccount {
  34  |     email: string;
  35  |     userId: string;
  36  |     firstName: string;
  37  |     lastName: string;
  38  |     partnerId?: string;
  39  | }
  40  | 
  41  | export interface DemoEvent {
  42  |     id: string;
  43  |     title: string;
  44  |     status: string;
  45  |     organizer: DemoAccountKey;
  46  | }
  47  | 
  48  | export interface DemoIds {
  49  |     version: typeof DEMO_IDS_VERSION;
  50  |     generatedAt: string;
  51  |     supabaseUrl: string;
  52  |     accounts: Record<DemoAccountKey, DemoAccount>;
  53  |     events: Record<DemoEventKey, DemoEvent>;
  54  |     /** Tous les événements du seed de démonstration, dans l'ordre de création. */
  55  |     allEvents: DemoEvent[];
  56  |     /**
  57  |      * Lot 7 : `clientVeille` (billet du client sur « la veille », dans la fenêtre hors ligne) et `manualLookup`
  58  |      * (billet jamais présenté de « ce soir », numéro saisi à la main par le contrôleur des captures).
  59  |      */
  60  |     tickets: { clientValide: string; clientUtilise: string; clientVeille: string; manualLookup: { id: string; number: string } };
  61  |     /**
  62  |      * Lot 6 : lignes de notification_outbox de la page admin « Notifications » : FAILED après 5 tentatives
  63  |      * (détail avec « Relancer »), SENT, et journal d'un code à usage unique (le code n'est jamais stocké).
  64  |      */
  65  |     notifications: { failedId: string; sentId: string; otpLogId: string };
  66  |     /** Lot 6 : transfert PENDING vers le numéro vérifié du client de démonstration (onglet « Reçus »). */
  67  |     transfers: { incomingId: string };
  68  |     /** Lot 7 (7.3) : paiements du client, en attente (réservation active), réussi et refusé (pages /paiement/<id>). */
  69  |     payments: { pending: string; success: string; failed: string };
  70  | }
  71  | 
  72  | const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  73  | 
  74  | export function writeDemoIds(ids: DemoIds): void {
  75  |     fs.mkdirSync(E2E_OUTPUT_DIR, { recursive: true });
  76  |     fs.writeFileSync(DEMO_IDS_FILE, `${JSON.stringify(ids, null, 2)}\n`, 'utf8');
  77  | }
  78  | 
  79  | let cached: DemoIds | null = null;
  80  | 
  81  | /** Lit et valide le fichier ; erreur explicite s'il manque (seed de démonstration non abouti). */
  82  | export function readDemoIds(): DemoIds {
  83  |     if (cached) return cached;
  84  |     if (!fs.existsSync(DEMO_IDS_FILE)) {
> 85  |         throw new Error(
      |               ^ Error: [e2e] .e2e-captures/demo-ids.json absent : « npm run seed:demo » n'a pas abouti (journal e2e-seed.log). Les écrans qui dépendent des données de démonstration ne peuvent pas être capturés.
  86  |             `[e2e] ${path.relative(process.cwd(), DEMO_IDS_FILE)} absent : « npm run seed:demo » n'a pas abouti ` +
  87  |             '(journal e2e-seed.log). Les écrans qui dépendent des données de démonstration ne peuvent pas être capturés.',
  88  |         );
  89  |     }
  90  |     const parsed = JSON.parse(fs.readFileSync(DEMO_IDS_FILE, 'utf8')) as Partial<DemoIds>;
  91  |     if (parsed.version !== DEMO_IDS_VERSION) {
  92  |         throw new Error(`[e2e] demo-ids.json : version ${String(parsed.version)} au lieu de ${DEMO_IDS_VERSION} (relancez seed:demo).`);
  93  |     }
  94  |     const missing = [
  95  |         ...DEMO_ACCOUNT_KEYS.filter((k) => !parsed.accounts?.[k]?.email).map((k) => `accounts.${k}`),
  96  |         ...DEMO_EVENT_KEYS.filter((k) => !parsed.events?.[k]?.id).map((k) => `events.${k}`),
  97  |         ...(['failedId', 'sentId', 'otpLogId'] as const)
  98  |             .filter((k) => !UUID_RE.test(String(parsed.notifications?.[k] ?? ''))).map((k) => `notifications.${k}`),
  99  |         ...(UUID_RE.test(String(parsed.transfers?.incomingId ?? '')) ? [] : ['transfers.incomingId']),
  100 |         ...(['clientValide', 'clientUtilise', 'clientVeille'] as const)
  101 |             .filter((k) => !UUID_RE.test(String(parsed.tickets?.[k] ?? ''))).map((k) => `tickets.${k}`),
  102 |         ...(UUID_RE.test(String(parsed.tickets?.manualLookup?.id ?? '')) && /^TCK-/.test(String(parsed.tickets?.manualLookup?.number ?? ''))
  103 |             ? [] : ['tickets.manualLookup']),
  104 |         ...(['pending', 'success', 'failed'] as const)
  105 |             .filter((k) => !UUID_RE.test(String(parsed.payments?.[k] ?? ''))).map((k) => `payments.${k}`),
  106 |         ...(parsed.accounts?.partenaireNeuf?.partnerId ? [] : ['accounts.partenaireNeuf.partnerId']),
  107 |     ];
  108 |     if (missing.length > 0) throw new Error(`[e2e] demo-ids.json incomplet : ${missing.join(', ')}.`);
  109 |     cached = parsed as DemoIds;
  110 |     return cached;
  111 | }
  112 | 
```