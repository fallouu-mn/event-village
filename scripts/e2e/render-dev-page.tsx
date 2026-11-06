/**
 * Lot 8 (contrat 15.8, décision L75) — rendu statique de la page de développement du faux SamirPay, pour la capture.
 * `next dev` ne tourne jamais en CI (AR2) et la page `*.dev.tsx` est absente du build : on rend le composant de
 * présentation pur, avec les feuilles de style du build, puis Playwright l'affiche par page.setContent (e2e/dev-page.spec.ts),
 * sans serveur d'application. Même modèle que scripts/e2e/render-emails.ts. Prouve l'apparence ; la route est couverte par
 * tests/parcours/essai-middleware.test.ts et e2e/fumee.spec.ts.
 *
 *   node --import tsx scripts/e2e/render-dev-page.tsx [--out <dossier>]
 *
 * Sortie : <dossier>/dev-paiements.html (défaut .e2e-captures/dev-page/) ; la dernière ligne de la sortie standard est le
 * manifeste JSON { html }.
 *
 * Forme attendue de components/dev/FakePaymentPanel.tsx (fix(8.1e), contrat 5.3 ; ce fichier la fixe faute de signature
 * au contrat) : export nommé `FakePaymentPanel`, props `{ payment: FakePayment }`, avec les boutons actifs « Valider le
 * paiement » et « Refuser le paiement » et la mention « Paiement simulé : aucun argent réel ». Le composant est absent
 * jusqu'à fix(8.1e) : le script s'arrête alors en le nommant.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const TAG = '[render-dev-page]';
const PANEL_FILE = path.join('components', 'dev', 'FakePaymentPanel.tsx');
const CSS_DIR = path.join('.next', 'static', 'css');

interface FakePayment { id: string; amount: number; operator: string; phone: string; status: 'PENDING'; createdAt: string }

/** Paiement d'exemple, fixe et fictif. */
const SAMPLE: FakePayment = {
    id: '4dcf19af-7d3e-48f0-8d26-a51427839f9f', amount: 5250, operator: 'Wave', phone: '77 123 45 67', status: 'PENDING', createdAt: '2026-11-06T18:30:00.000Z',
};

function stop(message: string): never {
    process.stderr.write(`${TAG} ${message}\n`);
    process.exit(1);
}

function outDir(argv: string[]): string {
    const i = argv.indexOf('--out');
    if (i === -1) return path.resolve(process.cwd(), '.e2e-captures', 'dev-page');
    const value = argv[i + 1];
    if (!value) stop('--out : dossier attendu');
    return path.resolve(process.cwd(), value);
}

/** Feuilles de style du build, en ligne : la page n'a ni serveur ni requête réseau. */
function buildCss(): string {
    const dir = path.resolve(process.cwd(), CSS_DIR);
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.css')).sort() : [];
    if (files.length === 0) stop(`aucune feuille de style dans ${CSS_DIR} : lancez le build avant cette phase.`);
    return files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
}

async function main(): Promise<void> {
    const dir = outDir(process.argv.slice(2));
    if (!fs.existsSync(path.resolve(process.cwd(), PANEL_FILE))) stop(`${PANEL_FILE} absent : la page de développement n'est pas encore livrée (fix(8.1e)).`);
    // Chemin en variable : le typage ne doit pas dépendre d'un composant livré après ce commit
    const modulePath = '../../components/dev/FakePaymentPanel';
    const loaded = (await import(modulePath)) as { FakePaymentPanel?: ComponentType<{ payment: FakePayment }> };
    const Panel = loaded.FakePaymentPanel;
    if (!Panel) stop(`${PANEL_FILE} n'exporte pas FakePaymentPanel.`);
    const markup = renderToStaticMarkup(createElement(Panel, { payment: SAMPLE }));
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
        + `<title>Paiement simulé</title><style>${buildCss()}</style></head>`
        + `<body class="min-h-screen antialiased font-sans"><main class="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">${markup}</main></body></html>`;
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'dev-paiements.html');
    fs.writeFileSync(file, html, 'utf8');
    process.stderr.write(`${TAG} ${path.relative(process.cwd(), file)} : ${html.length} caractères\n`);
    process.stdout.write(`${JSON.stringify({ html: file })}\n`);
}

main().catch((err: unknown) => {
    stop(err instanceof Error ? err.stack ?? err.message : String(err));
});
