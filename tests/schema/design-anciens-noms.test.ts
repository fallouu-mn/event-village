/**
 * Design 1a (point 1) — règle des anciens noms de couleur (scripts/design-anciens-noms.mjs).
 *
 * Les anciens noms (surface, fg, brand au sens du bouton principal, border-strong, -bg / -fg des états, anciennes
 * variables --bg-main, --brand-gradient…, anciennes classes .ev-btn-primary…) restent des alias vers la charte pour les
 * pages pas encore repeintes et les branches en cours, mais sont interdits dans tout fichier NOUVEAU ou MODIFIÉ de app/,
 * components/ et lib/ : l'inventaire tests/helpers/design-anciens-noms.json fige l'empreinte des fichiers qui les
 * employaient au départ du design 1a. Pour retirer un fichier de la règle : le passer entièrement aux noms de la charte.
 * Sortie brute `[DESIGN-ANCIENS-NOMS]`.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();

function node(args: string[]): { status: number | null; out: string } {
    const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
    return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

describe('design 1a — anciens noms de couleur', () => {
    test('la détection reconnaît les anciens noms et laisse les noms de la charte', () => {
        const samples = {
            old: ['bg-surface', 'bg-surface-sunken', 'text-fg', 'text-fg-muted', 'hover:bg-brand-hover', 'bg-brand/10', 'text-on-brand',
                'border-border-strong', 'text-success-fg', 'bg-danger-bg', 'from-brand-500', 'text-brand-fg', 'var(--bg-main)',
                'var(--brand-gradient)', 'ev-btn-primary', 'text-on-op-wave'],
            fresh: ['bg-background', 'bg-card', 'text-foreground', 'text-foreground-strong', 'text-muted-foreground', 'bg-primary',
                'hover:bg-primary-hover', 'text-primary-foreground', 'bg-brand-vif', 'text-brand-vif-foreground', 'border-border',
                'border-input', 'ring-ring', 'text-success-text', 'bg-danger-soft', 'bg-scan-accept-bg', 'text-on-tone', 'text-on-op',
                'bg-op-wave', 'var(--background)', 'ev-fade-in'],
        };
        const code = `import { oldNamesIn } from './scripts/design-anciens-noms.mjs';
            const s = ${JSON.stringify(samples)};
            console.log(JSON.stringify({ old: s.old.filter((x) => oldNamesIn(' ' + x + ' ').length === 0),
                                         fresh: s.fresh.filter((x) => oldNamesIn(' ' + x + ' ').length > 0) }));`;
        const r = node(['--input-type=module', '-e', code]);
        assert.equal(r.status, 0, r.out);
        const { old, fresh } = JSON.parse(r.out.split('\n').pop() ?? '{}') as { old: string[]; fresh: string[] };
        assert.deepEqual(old, [], `anciens noms non reconnus : ${old.join(', ')}`);
        assert.deepEqual(fresh, [], `noms de la charte pris pour d'anciens noms : ${fresh.join(', ')}`);
    });

    test('aucun fichier nouveau ou modifié n\'emploie un ancien nom', () => {
        const r = node(['scripts/design-anciens-noms.mjs']);
        console.log(`[DESIGN-ANCIENS-NOMS] ${r.out.split('\n').join(' | ')}`);
        assert.equal(r.status, 0, `anciens noms dans des fichiers nouveaux ou modifiés :\n${r.out}`);
    });
});
