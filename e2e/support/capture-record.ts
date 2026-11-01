/**
 * Lot 5.1 — résultat d'une capture (un fichier JSON par capture dans .e2e-captures/results/),
 * agrégé en index.txt par build-index.ts à la fin de chaque exécution de Playwright.
 */
import fs from 'node:fs';
import path from 'node:path';
import { RESULTS_DIR } from './demo-ids';

export interface CaptureRecord {
    file: string;
    screen: string;
    titre: string;
    vue: 'mobile' | 'ordinateur';
    theme: 'clair' | 'sombre';
    role: string;
    url: string | null;
    status: number | null;
    captured: boolean;
    blocking: string[];
    warnings: string[];
    /** Nœuds fautifs de chaque règle axe (checks.ts, AXE_NODES_PER_RULE par règle). Absent des anciens résultats. */
    axeDetails?: string[];
    notes: string[];
    error: string | null;
    durationMs: number;
}

export function writeCaptureRecord(record: CaptureRecord): void {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(RESULTS_DIR, `${record.file.replace(/\.png$/, '')}.json`), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
}

export function readCaptureRecords(): CaptureRecord[] {
    if (!fs.existsSync(RESULTS_DIR)) return [];
    return fs.readdirSync(RESULTS_DIR)
        .filter((f) => f.endsWith('.json'))
        .sort((a, b) => a.localeCompare(b))
        .map((f) => JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf8')) as CaptureRecord);
}
