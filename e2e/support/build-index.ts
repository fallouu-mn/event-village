/**
 * Lot 5.1 — globalTeardown de Playwright : construit .e2e-captures/captures/index.txt à partir
 * des résultats de chaque capture (écran, URL, rôle, contrôles bloquants, avertissements).
 * Sans résultat de capture (phase de connexion ou fumée seule), l'index n'est pas réécrit.
 *
 * Lot 6 (contrat A6, rapport 6.0 f) : en tête de l'index, le tableau « écran × règle » (cibles < 44 px,
 * textes < 14 px bruts, admis et hors exemption, règles axe), une colonne par vue et par thème ; chaque
 * capture liste ensuite TOUS ses textes hors exemption. Le même tableau, une ligne par capture, est écrit
 * dans .e2e-captures/captures/avertissements.tsv (publié avec les captures sur ci-results).
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
        ...(r.smallTextDetails ?? []).map((d) => `  texte < 14 px : hors exemption : ${d}`),
        ...r.notes.map((n) => `  note          : ${n}`),
    ];
    return lines.join('\n');
}

/** Ordre des colonnes du tableau : mobile clair, mobile sombre, ordinateur clair, ordinateur sombre. */
const VIEWS: ReadonlyArray<{ vue: CaptureRecord['vue']; theme: CaptureRecord['theme']; court: string }> = [
    { vue: 'mobile', theme: 'clair', court: 'm-c' },
    { vue: 'mobile', theme: 'sombre', court: 'm-s' },
    { vue: 'ordinateur', theme: 'clair', court: 'o-c' },
    { vue: 'ordinateur', theme: 'sombre', court: 'o-s' },
];

function cell(records: CaptureRecord[], value: (r: CaptureRecord) => number | null): string {
    return VIEWS.map((v) => {
        const r = records.find((x) => x.vue === v.vue && x.theme === v.theme);
        if (!r) return '—';
        const n = value(r);
        return n === null ? '?' : String(n);
    }).join('/');
}

function axeCell(records: CaptureRecord[]): string {
    const max = new Map<string, number>();
    for (const r of records) {
        for (const rule of r.metrics?.axeRules ?? []) max.set(rule.id, Math.max(max.get(rule.id) ?? 0, rule.nodes));
    }
    if (max.size === 0) return records.some((r) => r.metrics) ? 'aucune' : '?';
    return Array.from(max.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([id, n]) => `${id} (≤ ${n} nœud${n > 1 ? 's' : ''})`).join(', ');
}

/** Tableau « écran × règle » (texte), un écran par ligne, valeurs m-c/m-s/o-c/o-s. */
function warningTable(records: CaptureRecord[]): string[] {
    const screens = Array.from(new Set(records.map((r) => r.screen)));
    const lines = [
        'TABLEAU ÉCRAN × RÈGLE (avertissements ; valeurs par vue : m-c/m-s/o-c/o-s = mobile clair/sombre, ordinateur clair/sombre ; ? = contrôles non exécutés)',
        'écran | cibles < 44 px | textes < 14 px bruts | dont admis | dont hors exemption | axe (règles, nœuds au plus)',
    ];
    for (const screen of screens) {
        const rs = records.filter((r) => r.screen === screen);
        lines.push([
            screen,
            cell(rs, (r) => r.metrics?.smallTargets ?? null),
            cell(rs, (r) => r.metrics?.smallTexts ?? null),
            cell(rs, (r) => r.metrics?.smallTextsAdmitted ?? null),
            cell(rs, (r) => r.metrics?.smallTextsOutside ?? null),
            axeCell(rs),
        ].join(' | '));
    }
    return lines;
}

function tsvValue(v: string | number | null | undefined): string {
    return v === null || v === undefined ? '' : String(v).replace(/[\t\r\n]+/g, ' ');
}

/** Une ligne par capture : base du tableau « écran × règle » du rapport (6.0 f). */
function warningTsv(records: CaptureRecord[]): string {
    const header = ['ecran', 'vue', 'theme', 'resultat', 'cibles_44', 'textes_14_bruts', 'textes_14_admis', 'textes_14_hors_exemption', 'axe_regles', 'axe_detail', 'prechargements_abandonnes'];
    const rows = records.map((r) => [
        r.screen, r.vue, r.theme,
        r.error ? 'ECHEC' : r.blocking.length > 0 ? 'BLOQUANT' : 'OK',
        r.metrics?.smallTargets, r.metrics?.smallTexts, r.metrics?.smallTextsAdmitted, r.metrics?.smallTextsOutside,
        r.metrics?.axeViolations,
        (r.metrics?.axeRules ?? []).map((a) => `${a.id}:${a.nodes}`).join(';'),
        r.warnings.filter((w) => w.startsWith('préchargement Next abandonné')).length,
    ].map(tsvValue).join('\t'));
    return `${header.join('\t')}\n${rows.join('\n')}\n`;
}

export default async function buildIndex(): Promise<void> {
    const records = readCaptureRecords();
    if (records.length === 0) return;
    const failed = records.filter((r) => r.error || r.blocking.length > 0);
    const warned = records.filter((r) => r.warnings.length > 0);
    const outsideTotal = records.reduce((n, r) => n + (r.metrics?.smallTextsOutside ?? 0), 0);
    const prefetchTotal = records.reduce((n, r) => n + r.warnings.filter((w) => w.startsWith('préchargement Next abandonné')).length, 0);
    const header = [
        'EVENT VILLAGE — CAPTURES D’ÉCRAN (lot 5, tâche 5.1 ; lot 6, tâche 6.12)',
        `généré le      : ${new Date().toISOString()}`,
        process.env.GITHUB_RUN_NUMBER ? `run CI         : ${process.env.GITHUB_RUN_NUMBER}-${process.env.GITHUB_RUN_ID ?? ''} (${process.env.GITHUB_SHA ?? ''})` : 'run CI         : exécution locale',
        'format         : <écran>__<mobile|ordinateur>__<clair|sombre>.png — mobile 390×844 DPR 2, ordinateur 1440×900 DPR 1',
        `captures       : ${records.filter((r) => r.captured).length} / ${records.length} tentative(s)`,
        `en échec       : ${failed.length} (contrôles bloquants ou erreur)`,
        `avertissements : ${warned.length} capture(s) concernée(s) (cibles < 44 px, textes < 14 px, axe-core)`,
        `textes < 14 px : ${outsideTotal} hors exemption au total (détail sous chaque capture ; tableau : avertissements.tsv)`,
        `préchargements : ${prefetchTotal} préchargement(s) Next abandonné(s), non bloquants, listés sous chaque capture (network.ts, lot 6)`,
        'Relecture humaine obligatoire : un écran n’est terminé qu’une fois sa capture relue (rapport du lot, section 3).',
        '',
        ...warningTable(records),
        '',
    ];
    fs.mkdirSync(CAPTURES_DIR, { recursive: true });
    const out = path.join(CAPTURES_DIR, 'index.txt');
    fs.writeFileSync(out, `${header.join('\n')}\n${records.map(block).join('\n\n')}\n`, 'utf8');
    fs.writeFileSync(path.join(CAPTURES_DIR, 'avertissements.tsv'), warningTsv(records), 'utf8');
    console.log(`[e2e] index des captures : ${path.relative(process.cwd(), out)} (${records.length} entrée(s), ${failed.length} en échec)`);
}
