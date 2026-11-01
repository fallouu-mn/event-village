/**
 * Lot 5.1 — globalTeardown de Playwright : construit .e2e-captures/captures/index.txt à partir
 * des résultats de chaque capture (écran, URL, rôle, contrôles bloquants, avertissements).
 * Sans résultat de capture (phase de connexion ou fumée seule), l'index n'est pas réécrit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readCaptureRecords, type CaptureRecord } from './capture-record';
import { CAPTURES_DIR } from './demo-ids';

function block(r: CaptureRecord): string {
    const verdict = r.error
        ? `ÉCHEC (${r.captured ? 'capture faite' : 'aucune capture'}) : ${r.error}`
        : r.blocking.length > 0 ? `ÉCHEC : ${r.blocking.length} contrôle(s) bloquant(s)` : 'OK';
    const lines = [
        r.file,
        `  écran         : ${r.screen} — ${r.titre}`,
        `  url           : ${r.url ?? '(non résolue)'}${r.status !== null ? ` (HTTP ${r.status})` : ''}`,
        `  rôle          : ${r.role}`,
        `  résultat      : ${verdict}`,
        ...r.blocking.map((b) => `  bloquant      : ${b}`),
        ...r.warnings.map((w) => `  avertissement : ${w}`),
        ...(r.axeDetails ?? []).map((d) => `  axe nœud      : ${d}`),
        ...r.notes.map((n) => `  note          : ${n}`),
    ];
    return lines.join('\n');
}

export default async function buildIndex(): Promise<void> {
    const records = readCaptureRecords();
    if (records.length === 0) return;
    const failed = records.filter((r) => r.error || r.blocking.length > 0);
    const warned = records.filter((r) => r.warnings.length > 0);
    const header = [
        'EVENT VILLAGE — CAPTURES D’ÉCRAN (lot 5, tâche 5.1)',
        `généré le      : ${new Date().toISOString()}`,
        process.env.GITHUB_RUN_NUMBER ? `run CI         : ${process.env.GITHUB_RUN_NUMBER}-${process.env.GITHUB_RUN_ID ?? ''} (${process.env.GITHUB_SHA ?? ''})` : 'run CI         : exécution locale',
        'format         : <écran>__<mobile|ordinateur>__<clair|sombre>.png — mobile 390×844 DPR 2, ordinateur 1440×900 DPR 1',
        `captures       : ${records.filter((r) => r.captured).length} / ${records.length} tentative(s)`,
        `en échec       : ${failed.length} (contrôles bloquants ou erreur)`,
        `avertissements : ${warned.length} capture(s) concernée(s) (cibles < 44 px, textes < 14 px, axe-core)`,
        'Relecture humaine obligatoire : un écran n’est terminé qu’une fois sa capture relue (rapport du lot, section 3).',
        '',
    ];
    fs.mkdirSync(CAPTURES_DIR, { recursive: true });
    const out = path.join(CAPTURES_DIR, 'index.txt');
    fs.writeFileSync(out, `${header.join('\n')}\n${records.map(block).join('\n\n')}\n`, 'utf8');
    console.log(`[e2e] index des captures : ${path.relative(process.cwd(), out)} (${records.length} entrée(s), ${failed.length} en échec)`);
}
