/**
 * Lot 5.1 — identifiants du seed de démonstration (tests/seed/seed-demo.ts), lus par les specs.
 * Le fichier est écrit dans `.e2e-captures/` (ignoré par git). Module pur : aucun client Supabase.
 */
import fs from 'node:fs';
import path from 'node:path';

export const E2E_OUTPUT_DIR = path.resolve(process.cwd(), '.e2e-captures');
export const DEMO_IDS_FILE = path.join(E2E_OUTPUT_DIR, 'demo-ids.json');
export const CAPTURES_DIR = path.join(E2E_OUTPUT_DIR, 'captures');
export const RESULTS_DIR = path.join(E2E_OUTPUT_DIR, 'results');

export const DEMO_IDS_VERSION = 1;

export const DEMO_ACCOUNT_KEYS = [
    'organisateur', 'organisateur2', 'organisateur3', 'admin', 'client', 'controleur', 'controleur2', 'controleur3',
] as const;
export type DemoAccountKey = typeof DEMO_ACCOUNT_KEYS[number];

export const DEMO_EVENT_KEYS = [
    'ceSoir', 'publie', 'publieComplet', 'suspendu', 'annule', 'annuleSansVente', 'termine', 'termine2',
    'valide', 'enAttente', 'brouillon', 'refuse',
] as const;
export type DemoEventKey = typeof DEMO_EVENT_KEYS[number];

export interface DemoAccount {
    email: string;
    userId: string;
    firstName: string;
    lastName: string;
    partnerId?: string;
}

export interface DemoEvent {
    id: string;
    title: string;
    status: string;
    organizer: DemoAccountKey;
}

export interface DemoIds {
    version: typeof DEMO_IDS_VERSION;
    generatedAt: string;
    supabaseUrl: string;
    accounts: Record<DemoAccountKey, DemoAccount>;
    events: Record<DemoEventKey, DemoEvent>;
    /** Tous les événements du seed de démonstration, dans l'ordre de création. */
    allEvents: DemoEvent[];
    tickets: { clientValide: string; clientUtilise: string };
}

export function writeDemoIds(ids: DemoIds): void {
    fs.mkdirSync(E2E_OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(DEMO_IDS_FILE, `${JSON.stringify(ids, null, 2)}\n`, 'utf8');
}

let cached: DemoIds | null = null;

/** Lit et valide le fichier ; erreur explicite s'il manque (seed de démonstration non abouti). */
export function readDemoIds(): DemoIds {
    if (cached) return cached;
    if (!fs.existsSync(DEMO_IDS_FILE)) {
        throw new Error(
            `[e2e] ${path.relative(process.cwd(), DEMO_IDS_FILE)} absent : « npm run seed:demo » n'a pas abouti ` +
            '(journal e2e-seed.log). Les écrans qui dépendent des données de démonstration ne peuvent pas être capturés.',
        );
    }
    const parsed = JSON.parse(fs.readFileSync(DEMO_IDS_FILE, 'utf8')) as Partial<DemoIds>;
    if (parsed.version !== DEMO_IDS_VERSION) {
        throw new Error(`[e2e] demo-ids.json : version ${String(parsed.version)} au lieu de ${DEMO_IDS_VERSION} (relancez seed:demo).`);
    }
    const missing = [
        ...DEMO_ACCOUNT_KEYS.filter((k) => !parsed.accounts?.[k]?.email).map((k) => `accounts.${k}`),
        ...DEMO_EVENT_KEYS.filter((k) => !parsed.events?.[k]?.id).map((k) => `events.${k}`),
    ];
    if (missing.length > 0) throw new Error(`[e2e] demo-ids.json incomplet : ${missing.join(', ')}.`);
    cached = parsed as DemoIds;
    return cached;
}
