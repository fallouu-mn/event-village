/**
 * Lot 11c-b — contrôles statiques des écrans du client pour les tables d'un événement (aucune base).
 *
 *  1. Poids : un seul import() par module (onglet « Tables », « Ma table », plan de salle) ; la fiche et Mes billets
 *     n'importent statiquement rien des écrans des tables (seulement les chargeurs) ; la bascule de la fiche n'est rendue
 *     que si le serveur a trouvé une offre.
 *  2. Aucun montant ni nombre de places calculé dans le navigateur : pas d'opération arithmétique sur un prix, un total,
 *     des frais, des places ; les montants affichés viennent des réponses du serveur.
 *  3. Mouvement : animations par échelle et opacité seulement, coupées si « réduire les animations ».
 *  4. Plan : états lisibles sans la couleur (hachures et mot « Prise » au choix, coche de « Votre table »), zoom aux
 *     boutons en plus du pincement, survol à la souris.
 *  5. Liens : avis vers « Ma table », suivi du paiement vers « Ma table » et « Réessayer » vers l'onglet « Tables ».
 *  6. Fichiers des écrans déclarés au système de design.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MIGRATED_DESIGN_FILES } from '../helpers/design-files';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const CLIENT_DIR = 'components/event-tables/client';
const SCREENS = ['TablesOffer.tsx', 'PlanView.tsx', 'PlanDialog.tsx', 'PayStep.tsx', 'HoldCountdown.tsx', 'TableConfirmed.tsx', 'MyTables.tsx', 'offer-api.ts'].map((f) => `${CLIENT_DIR}/${f}`);

/** Code sans commentaires (// et bloc), pour ne juger que ce qui s'exécute. */
function code(rel: string): string {
    return read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) { if (entry.name !== 'node_modules') walk(rel, out); }
        else if (/\.(tsx?|mjs)$/.test(entry.name)) out.push(rel);
    }
    return out;
}

describe('1. Poids : rien des tables au premier chargement, un seul chargeur par module', () => {
    const sources = [...walk('app'), ...walk('components'), ...walk('lib'), ...walk('hooks')];
    const count = (re: RegExp) => sources.flatMap((f) => (code(f).match(re) ?? []).map(() => f));

    test('un seul import() de l’onglet « Tables », de « Ma table » et du plan de salle', () => {
        assert.deepEqual(count(/import\(\s*['"][^'"]*TablesOffer['"]\s*\)/g), [`${CLIENT_DIR}/load.ts`]);
        assert.deepEqual(count(/import\(\s*['"][^'"]*MyTables['"]\s*\)/g), [`${CLIENT_DIR}/load.ts`]);
        assert.deepEqual(count(/import\(\s*['"][^'"]*FloorPlan['"]\s*\)/g), ['components/tables/plan/load.ts'], 'plan : chargeur unique partagé avec le choix d’une table de restaurant');
    });

    test('la fiche, sa bascule et Mes billets n’importent statiquement que les chargeurs', () => {
        for (const rel of ['app/events/[id]/page.tsx', 'components/event-page/TicketingSwitch.tsx', 'app/tickets/TicketsView.tsx', 'components/tickets/TicketCard.tsx']) {
            const imports = Array.from(code(rel).matchAll(/^import[^;]*from\s+['"]([^'"]+)['"]/gm), (m) => m[1]);
            const tables = imports.filter((m) => m.includes('event-tables/client') || m.includes('tables/plan/FloorPlan'));
            for (const m of tables) assert.equal(m, '@/components/event-tables/client/load', `${rel} : ${m} importé au premier chargement`);
        }
        const view = code('app/tickets/TicketsView.tsx');
        assert.match(view, /const MyTables = dynamic\(\(\) => loadMyTables\(\)/, 'Ma table : chargée par son chargeur');
        assert.match(view, /tab === 'tables' \? \(\s*<MyTables /, 'Ma table rendue seulement dans l’onglet « Tables »');
        const sw = code('components/event-page/TicketingSwitch.tsx');
        assert.match(sw, /dynamic\(\(\) => loadTablesOffer\(\)/, 'onglet « Tables » : chargé par son chargeur');
        assert.match(sw, /\{tablesMounted && <TablesOffer /, 'onglet monté seulement à son ouverture');
        const page = code('app/events/[id]/page.tsx');
        assert.match(page, /const tables = event\.status === 'PUBLIE' \? await readTablesSummary\(event\.id\) : null;/);
        assert.match(page, /\{tables \? \(\s*<TicketingSwitch/, 'bascule seulement si le serveur a trouvé une offre');
        assert.match(page, /<EventTicketing initial=\{event\} \/>\s*\)\}/, 'billetterie seule sans tables');
    });

    test('le résumé de la fiche vient de event_table_offer (service ouvert, types en vente) ; une panne n’arrête pas la fiche', () => {
        const summary = code('lib/event-tables/offer-summary.server.ts');
        assert.match(summary, /callTables\('event_table_offer'/);
        assert.match(summary, /offer\.open !== true/);
        assert.match(summary, /console\.error\(/, 'panne journalisée');
    });
});

describe('2. Aucun montant ni nombre de places calculé dans le navigateur', () => {
    const MONEY = '(price|total|fee|serviceFee|amount|seats|remainingTables|totalTables|pricePerPerson|inviteLeft|toSend|to_send|sent|entered|pending)';
    const ARITH = new RegExp(`\\b${MONEY}\\b\\s*[-+*/%]\\s*[\\w(.]|[\\w).]\\s*[-+*/%]\\s*\\b(?:[a-zA-Z_]+\\.)*${MONEY}\\b`);

    test('écrans des tables : aucune opération arithmétique sur un prix, un total, des frais ou des places', () => {
        const faults: string[] = [];
        for (const rel of [...SCREENS, 'components/event-page/TicketingSwitch.tsx']) {
            code(rel).split('\n').forEach((line, i) => {
                if (ARITH.test(line)) faults.push(`${rel}:${i + 1} ${line.trim()}`);
            });
        }
        assert.deepEqual(faults, [], faults.join('\n'));
    });

    test('auto-test du détecteur', () => {
        assert.ok(ARITH.test('const toSend = table.seats - 1;'));
        assert.ok(ARITH.test('total: price + fee'));
        assert.ok(ARITH.test('x = quote.total * 2'));
        assert.ok(!ARITH.test('formatFcfa(quote.total)'));
        assert.ok(!ARITH.test('zoomTo(zoom + ZOOM_STEP)'));
    });

    test('places à inviter servies par le serveur (même règle que le rappel en base), affichées telles quelles', () => {
        const server = code('lib/event-tables/my-table.server.ts');
        assert.match(server, /invite_left: Number\.isFinite\(toSend\) \? Math\.max\(0, toSend - 1\) : 0/);
        assert.match(code(`${CLIENT_DIR}/TableConfirmed.tsx`), /`Envoyez vos \$\{table\.inviteLeft\} places`/);
        assert.match(code(`${CLIENT_DIR}/MyTables.tsx`), /`Envoyez vos \$\{table\.inviteLeft\} places`/);
    });

    test('refus du serveur affichés tels quels (message de la réponse)', () => {
        assert.match(code(`${CLIENT_DIR}/TablesOffer.tsx`), /serverErrorMessage\(body\) \?\?/);
        assert.match(code(`${CLIENT_DIR}/PayStep.tsx`), /readPaymentError\(res\.status, json\)/);
        assert.match(code(`${CLIENT_DIR}/MyTables.tsx`), /toast\.error\(serverErrorMessage\(body\) \?\?/);
    });
});

describe('3. Mouvement : échelle et opacité, coupé si « réduire les animations »', () => {
    test('chaque animation vérifie prefers-reduced-motion et n’anime que scale et opacity', () => {
        for (const rel of [`${CLIENT_DIR}/PlanView.tsx`, `${CLIENT_DIR}/MyTables.tsx`, `${CLIENT_DIR}/TableConfirmed.tsx`]) {
            const src = code(rel);
            assert.match(src, /prefers-reduced-motion: reduce/, `${rel} : mouvement réduit respecté`);
            for (const m of src.matchAll(/\.animate\(\s*\[([\s\S]*?)\]/g)) {
                const keys = Array.from(m[1].matchAll(/(\w+)\s*:/g), (k) => k[1]);
                assert.deepEqual([...new Set(keys)].sort(), ['opacity', 'scale'], `${rel} : propriétés animées ${keys.join(', ')}`);
            }
        }
        assert.match(code(`${CLIENT_DIR}/TableConfirmed.tsx`), /if \(!reduce && typeof navigator\.vibrate === 'function'\) navigator\.vibrate\(/, 'vibration seulement si possible et sans mouvement réduit');
    });
});

describe('4. Plan : lisible sans la couleur, zoom sans geste obligatoire', () => {
    test('FloorPlan : hachures et mot « Prise » au choix d’une table, identifiant de table pour l’animation', () => {
        const plan = code('components/tables/plan/FloorPlan.tsx');
        assert.match(plan, /const takenToChoose = mode === 'select' && state === 'PRISE';/);
        assert.match(plan, /takenToChoose && '\[background-image:repeating-linear-gradient\(/);
        assert.match(plan, /labels\?\.PRISE\?\.legend \?\? 'Prise'/);
        assert.match(plan, /data-table-id=\{t\.id\}/);
    });

    test('vue du plan : libellés de l’événement, boutons de zoom, pincement, survol', () => {
        const view = code(`${CLIENT_DIR}/PlanView.tsx`);
        assert.match(view, /PRISE: \{ legend: 'Prise', spoken: 'prise' \}/);
        assert.match(view, /CHOISIE: \{ legend: 'Votre table', spoken: 'votre table' \}/);
        for (const label of ['Réduire le plan', 'Plan entier', 'Agrandir le plan']) assert.ok(view.includes(`aria-label="${label}"`), label);
        assert.match(view, /addEventListener\('touchmove', onMove, \{ passive: false \}\)/, 'pincement à deux doigts');
        assert.match(view, /onPointerOver=\{\(e\) => \{ if \(e\.pointerType === 'mouse'\) showHover/, 'survol à la souris');
    });

    test('compte à rebours : avertissement à 1 minute avec icône et texte, annonce aux paliers seulement', () => {
        const hold = code(`${CLIENT_DIR}/HoldCountdown.tsx`);
        assert.match(hold, /const warning = left > 0 && left <= 60;/);
        assert.match(hold, /<AlertTriangle/);
        assert.match(hold, /role="timer" aria-live="off"/);
    });
});

describe('5. Liens vers « Ma table »', () => {
    test('avis, suivi du paiement, confirmation', () => {
        assert.match(code('lib/notifications/catalog.ts'), /const myTablePath = \(d: object\): string => \(optText\(d, 'booking_id'\) \? `\/tickets\?tab=tables#table-\$\{ident\(d, 'booking_id'\)\}`/);
        const status = code('app/api/payments/[transactionId]/status/route.ts');
        assert.match(status, /success_url: table\?\.bookingId \? `\/tickets\?tab=tables#table-\$\{table\.bookingId\}`/);
        assert.match(status, /retry_url: table && payment\.event_id \? `\/events\/\$\{payment\.event_id\}\?tables=1`/);
        assert.match(code(`${CLIENT_DIR}/TableConfirmed.tsx`), /href=\{`\/tickets\?tab=tables#table-\$\{table\.bookingId\}`\}/);
        assert.match(code('app/tickets/tabs.ts'), /'recus', 'tables'\] as const/);
    });

    test('billet : libellé de la table, « Invité par » seulement pour un invité, identifiant de la vente seulement pour le titulaire', () => {
        const helper = code('lib/event-tables/ticket-tables.server.ts');
        assert.match(helper, /bookingId: holder === readerId \? String\(booking\.id\) : null/);
        assert.match(helper, /invitedBy: holder === readerId \? null : \(names\.get\(holder\) \?\? null\)/);
        assert.match(code('components/tickets/TicketCard.tsx'), /Invité par \{tableInvitedBy\}/);
    });
});

describe('6. Système de design', () => {
    test('écrans du lot déclarés dans tests/helpers/design-files.ts', () => {
        for (const rel of [...SCREENS.filter((f) => f.endsWith('.tsx')), 'components/event-page/TicketingSwitch.tsx']) {
            assert.ok(MIGRATED_DESIGN_FILES.includes(rel), `${rel} absent de la liste du système de design`);
        }
    });
});
