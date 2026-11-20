/**
 * Design 1c — espace organisatrice : textes justes et règles de mise en page figés (contrôle statique, sans base).
 *  - caisse : « Récapitulatif » au lieu de « Z » ; écart dit en mots (« Il manque … », « … de trop », « Aucun écart »),
 *    une seule fonction (lib/partner/ecart-caisse.ts) ; code PIN du régisseur annoncé et saisi en 6 chiffres ;
 *  - un seul nom pour le net, « Recettes nettes », détail brut → remboursements → net sans double déduction (écrans et
 *    PDF de clôture, constat G-26) ;
 *  - retraits : « Montant envoyé » tant que ce n'est pas versé, « Versé le <date> » seulement pour un retrait payé
 *    (constats N-02, E-03), même fonction aux Finances et au portefeuille ;
 *  - email obligatoire à l'inscription et au profil de l'organisatrice ; blocage des retraits 24 h après un changement
 *    de numéro annoncé dans la boîte de changement ; lien « Statistiques de ventes » masqué sans vente ;
 *  - « Restaurant » n'est plus en tête des activités ; billetterie d'abord, services fermés en dernier ;
 *  - tableau de bord : chiffres qui comptent une seule fois, coupés si « réduire les animations » ;
 *  - formulaire d'événement : étapes numérotées (courante, terminée), un seul grand bouton en dégradé ;
 *  - aucune couleur en dur ni ancien nom de couleur dans les fichiers du périmètre.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ecartCaisseText, ecartCaisseTone } from '../../lib/partner/ecart-caisse';
import { isWithdrawalPaid, withdrawalAmountLine } from '../../lib/finance/withdrawal-text';
import { orderedPartnerActivities } from '../../lib/partner/activity-labels';
import { PartnerActivityTypes } from '../../lib/validations/auth';
import { oldNamesIn } from '../../scripts/design-anciens-noms.mjs';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
/** Espaces de lib/format (insécables, fines) ramenées à une espace simple. */
const plain = (s: string): string => s.replace(/[  ]/g, ' ');

/** Fichiers d'écran du périmètre « espace organisatrice » (hors salles, tables, produits, commandes : lot 10b). */
function scopeFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
            const rel = `${dir}/${e.name}`;
            if (e.isDirectory()) {
                if (['app/partner/halls', 'app/partner/tables', 'app/partner/products', 'app/partner/orders'].includes(rel)) continue;
                walk(rel);
            } else if (/\.tsx?$/.test(e.name)) out.push(rel);
        }
    };
    walk('app/partner');
    walk('components/partner');
    return [
        ...out,
        'app/wallet/page.tsx',
        'components/events/EventForm.tsx',
        'components/events/EventCalendar.tsx',
        'components/shifts/ShiftModals.tsx',
        'components/scan/ScannerShiftBanner.tsx',
        'components/ui/KpiCard.tsx',
        'lib/partner/partner-dashboard.service.ts',
        'lib/partner/ecart-caisse.ts',
        'lib/finance/withdrawal-text.ts',
    ].sort();
}

const HARD_COLOR_RE = new RegExp(
    '(?<![a-zA-Z0-9-])(?:bg|text|border(?:-[trblxy])?|ring|from|via|to|fill|stroke|divide|shadow|outline|placeholder|decoration|caret|accent)-'
    + '(?:(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}|white|black)(?![a-zA-Z0-9-])'
    + '|#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\\b|\\brgba?\\(',
    'g',
);

describe('design 1c organisatrice — couleurs', () => {
    test('aucune couleur en dur ni ancien nom dans les fichiers du périmètre', () => {
        const files = scopeFiles();
        assert.ok(files.length > 40, `périmètre lu (${files.length} fichiers)`);
        const faults: string[] = [];
        for (const f of files) {
            const text = read(f);
            const hard = [...new Set(text.match(HARD_COLOR_RE) ?? [])];
            if (hard.length) faults.push(`${f} : couleur en dur ${hard.join(', ')}`);
            const old = oldNamesIn(text);
            if (old.length) faults.push(`${f} : ancien nom ${old.join(', ')}`);
        }
        assert.deepEqual(faults, []);
    });
});

describe('design 1c organisatrice — caisse', () => {
    test('écart dit en mots, jamais par un signe (écart = compté − attendu)', () => {
        assert.equal(plain(ecartCaisseText(-2000)), 'Il manque 2 000 F CFA');
        assert.equal(plain(ecartCaisseText(2000)), '2 000 F CFA de trop');
        assert.equal(ecartCaisseText(0), 'Aucun écart');
        assert.equal(ecartCaisseText(Number.NaN), 'Écart inconnu');
        for (const v of [-2000, 2000, -1, 1]) assert.doesNotMatch(ecartCaisseText(v), /[+−-]\s?\d/, `${v} : aucun signe`);
        assert.equal(ecartCaisseTone(0), 'success');
        assert.equal(ecartCaisseTone(-1), 'danger');
        assert.equal(ecartCaisseTone(1), 'warning');
    });

    test('une seule fonction d’écart : caisse du pilotage, clôture, fenêtres de caisse', () => {
        for (const f of ['components/partner/pilotage/CashTab.tsx', 'components/partner/pilotage/ClosingTab.tsx', 'components/shifts/ShiftModals.tsx']) {
            assert.match(read(f), /import \{[^}]*ecartCaisseText[^}]*\} from '@\/lib\/partner\/ecart-caisse'/, f);
        }
    });

    test('« Récapitulatif » au lieu de « Z » à l’écran', () => {
        const modals = read('components/shifts/ShiftModals.tsx');
        assert.match(modals, /Récapitulatif de caisse/);
        assert.match(modals, /Imprimer le récapitulatif/);
        assert.match(read('components/partner/pilotage/ClosingTab.tsx'), /Récapitulatifs de caisse/);
        for (const f of ['components/shifts/ShiftModals.tsx', 'components/partner/pilotage/ClosingTab.tsx', 'components/partner/pilotage/CashTab.tsx', 'components/scan/ScannerShiftBanner.tsx']) {
            const text = read(f);
            assert.doesNotMatch(text, /Z de caisse|Imprimer le Z|(?:le|du|un) Z\b|["'>]Z["'<]/, `${f} : plus de « Z »`);
        }
    });

    test('code PIN du régisseur : 6 chiffres annoncés et saisis', () => {
        const modals = read('components/shifts/ShiftModals.tsx');
        const pin = modals.slice(modals.indexOf('label="Code PIN du régisseur"'), modals.indexOf('label="Code PIN du régisseur"') + 600);
        assert.ok(pin.length > 100, 'champ du PIN trouvé');
        assert.match(pin, /hint="6 chiffres\./);
        assert.match(pin, /inputMode="numeric"/);
        assert.match(pin, /pattern="\[0-9\]\{6\}"/);
        assert.match(pin, /maxLength=\{6\}/);
        assert.match(modals, /\/\^\\d\{6\}\$\/\.test\(pin\)/);
        assert.match(modals, /Le code PIN du régisseur compte 6 chiffres\./);
        const cash = read('components/partner/pilotage/CashTab.tsx');
        assert.match(cash, /Code de 6 chiffres, exigé à l’ouverture de chaque caisse/);
        assert.match(cash, /Code de 6 chiffres\. Notez-le maintenant/);
    });
});

describe('design 1c organisatrice — recettes nettes', () => {
    const NET_FILES = [
        'app/partner/dashboard/page.tsx',
        'app/partner/events/page.tsx',
        'components/partner/pilotage/OverviewTab.tsx',
        'components/partner/pilotage/SalesTab.tsx',
        'components/partner/pilotage/ClosingReportSummary.tsx',
        'lib/partner/partner-dashboard.service.ts',
    ];

    test('un seul nom : « Recettes nettes » (plus de « Net partenaire », « Montant net organisateur »…)', () => {
        for (const f of NET_FILES) {
            const text = read(f);
            assert.match(text, /Recettes nettes/, `${f} : « Recettes nettes »`);
            assert.doesNotMatch(text, /Net partenaire|Montant net organisateur|MONTANT NET ORGANISATEUR|Net organisateur en ligne|Recettes en ligne nettes|['"`>]Recettes en ligne/, `${f} : ancien nom du net`);
        }
    });

    test('détail brut → remboursements → net, sans double déduction (G-26)', () => {
        const summary = read('components/partner/pilotage/ClosingReportSummary.tsx');
        const gross = summary.indexOf('Ventes en ligne (brut)');
        const refunds = summary.indexOf('"Remboursements"');
        const net = summary.indexOf('"Recettes nettes"', gross);
        assert.ok(gross > 0 && refunds > gross && net > refunds, 'ordre brut → remboursements → net dans le rapport de clôture');
        // revenue.online est déjà net (Σ VENTE + REMBOURSEMENT) : brut = online_gross, remboursements = refunded_online
        assert.match(summary, /online_gross/);
        assert.match(summary, /refunded_online/);
        assert.doesNotMatch(summary, /label="Remboursé"/);
        const overview = read('components/partner/pilotage/OverviewTab.tsx');
        assert.match(overview, /Ventes en ligne \(brut\)/);
        assert.match(overview, /hint="Ventes en ligne moins les remboursements\."/);
        const dash = read('app/partner/dashboard/page.tsx');
        assert.match(dash, /label="Ventes en ligne \(brut\)"/);
        assert.match(dash, /label="Recettes nettes"/);
        assert.match(dash, /header: 'Recettes nettes'/);
        assert.match(dash, /Remboursements : /);
    });

    test('PDF de clôture : mêmes mots qu’à l’écran', () => {
        const pdf = read('lib/partner/partner-dashboard.service.ts');
        assert.match(pdf, /\['Recettes nettes',/);
        assert.match(pdf, /RECETTES NETTES -- VENTES EN LIGNE MOINS LES REMBOURSEMENTS/);
        assert.match(pdf, /Recettes nettes \(F CFA\)/);
        assert.match(pdf, /Ventes en ligne \(brut\)/);
    });
});

describe('design 1c organisatrice — retraits', () => {
    const base = { net: 5940, fee: 60, processedAt: '2026-11-19T10:00:00Z' };

    test('« Versé le » seulement pour un retrait payé ; « Montant envoyé » sinon', () => {
        assert.match(plain(withdrawalAmountLine({ ...base, status: 'PAID', delayed: false })), /^Versé le .+ : 5 940 F CFA · frais : 60 F CFA$/);
        for (const status of ['PENDING', 'PROCESSING']) {
            const line = plain(withdrawalAmountLine({ ...base, status, delayed: false }));
            assert.equal(line, 'Montant envoyé : 5 940 F CFA · frais : 60 F CFA', status);
        }
        // Retardé : jamais « Versé », même si un statut payé était servi
        assert.doesNotMatch(withdrawalAmountLine({ ...base, status: 'PAID', delayed: true }), /^Versé/);
        assert.doesNotMatch(withdrawalAmountLine({ ...base, status: 'PROCESSING', delayed: true }), /^Versé/);
        for (const status of ['REJECTED', 'CANCELLED']) assert.doesNotMatch(withdrawalAmountLine({ ...base, status, delayed: false }), /Versé|envoyé/, status);
        assert.equal(isWithdrawalPaid({ status: 'PAID', delayed: false }), true);
        assert.equal(isWithdrawalPaid({ status: 'PROCESSING', delayed: false }), false);
    });

    test('Finances et portefeuille passent par la même fonction', () => {
        for (const f of ['app/partner/finance/page.tsx', 'app/wallet/page.tsx']) {
            const text = read(f);
            assert.match(text, /withdrawalAmountLine\(/, f);
            assert.doesNotMatch(text, /Versé : \{formatFcfa/, `${f} : plus de « Versé » écrit à la main`);
        }
    });

    test('lien « Statistiques de ventes » masqué sans vente', () => {
        const finance = read('app/partner/finance/page.tsx');
        assert.match(finance, /const hasSales = account !== null && \(/);
        assert.match(finance, /\{hasSales && \(\n\s+<LinkButton href="\/partner\/stats"[^\n]*\n\s+Statistiques de ventes/);
        assert.equal((finance.match(/\n\s+Statistiques de ventes\n/g) ?? []).length, 1, 'un seul lien, sous condition');
    });
});

describe('design 1c organisatrice — compte', () => {
    test('email obligatoire à l’inscription et au profil', () => {
        for (const f of ['app/partner/register/page.tsx', 'app/partner/profile/page.tsx']) {
            const text = read(f);
            const at = text.indexOf('label="Email"');
            assert.ok(at > 0, `${f} : libellé « Email »`);
            const field = text.slice(Math.max(0, at - 300), at + 700);
            assert.match(field, /aside="obligatoire"/, f);
            assert.match(field, /aria-required="true"/, f);
            assert.match(field, /Vos confirmations et rapports y arrivent\./, f);
            assert.doesNotMatch(text, /Recommandé/, `${f} : plus de « Recommandé »`);
        }
    });

    test('blocage des retraits 24 h annoncé dans la boîte de changement de numéro', () => {
        const dialog = read('components/profile/PhoneChangeDialog.tsx');
        assert.match(dialog, /'Les retraits sont bloqués 24 h après un changement de numéro\.'/);
        assert.match(dialog, /<StatusBanner tone="warning" title=\{WITHDRAWAL_LOCK_NOTICE\} \/>/);
    });

    test('« Restaurant » n’est plus en tête : billetterie d’abord, services fermés en dernier', () => {
        const closed = orderedPartnerActivities(PartnerActivityTypes, null);
        assert.equal(closed[0], 'ORGANISATEUR');
        assert.ok(closed.indexOf('RESTAURANT') > closed.indexOf('PRESTATAIRE'), 'restaurant après les activités de billetterie');
        assert.equal(closed[closed.length - 1], 'AUTRE');
        const allClosed = orderedPartnerActivities(PartnerActivityTypes, { halls: false, tables: false, orders: false });
        assert.deepEqual(allClosed, closed);
        const ordersOpen = orderedPartnerActivities(PartnerActivityTypes, { halls: false, tables: false, orders: true });
        assert.equal(ordersOpen[0], 'ORGANISATEUR');
        assert.ok(ordersOpen.indexOf('RESTAURANT') < ordersOpen.indexOf('SALLE'), 'service ouvert avant service fermé');
        assert.equal(new Set(closed).size, PartnerActivityTypes.length, 'chaque activité rendue une fois');
        for (const f of ['app/partner/register/page.tsx', 'app/partner/profile/page.tsx']) assert.match(read(f), /orderedPartnerActivities\(/, f);
    });
});

describe('design 1c organisatrice — tableau de bord et formulaire', () => {
    test('chiffres qui comptent une seule fois, rien si « réduire les animations », valeur réelle lue', () => {
        const src = read('components/ui/KpiCard.tsx');
        const start = src.indexOf('function KpiCountUp(');
        assert.ok(start > 0, 'comptage dans KpiCard (option countUp)');
        const fn = src.slice(start, src.indexOf('\n}\n', start));
        assert.match(fn, /requestAnimationFrame/);
        assert.match(src, /KPI_COUNT_UP_MS = 700/);
        assert.match(src, /\(prefers-reduced-motion: reduce\)/);
        assert.match(fn, /prefersReducedMotion\(\)\) return undefined;/, 'coupé si « réduire les animations »');
        assert.match(fn, /\}, \[\]\);/, 'effet sans dépendance : une seule fois par montage');
        assert.match(fn, /if \(frame === null\) return <>\{children\}<\/>;/, 'valeur réelle en texte simple une fois fini');
        assert.match(fn, /<span className="sr-only">\{children\}<\/span>/, 'valeur réelle lue pendant le comptage');
        assert.match(fn, /<span aria-hidden="true" className="inline-grid">/);
        assert.match(fn, /<span className="invisible \[grid-area:1\/1\]">\{children\}<\/span>/, 'place réservée par la valeur finale');
        assert.match(src, /tabular-nums/);
        assert.doesNotMatch(fn, /setInterval|animate-|infinite/);
        const dash = read('app/partner/dashboard/page.tsx');
        assert.equal((dash.match(/countUp=\{kpis \? \{ to: kpis\.\w+, format: '(?:fcfa|integer)' \} : undefined\}/g) ?? []).length, 4, 'quatre indicateurs animés');
    });

    test('tableaux du tableau de bord : cartes sur téléphone, aucun texte tronqué', () => {
        const dash = read('app/partner/dashboard/page.tsx');
        assert.match(dash, /<DataList[\s\S]*?breakpoint="xl"/);
        assert.doesNotMatch(dash, /\btruncate\b|line-clamp/);
        assert.doesNotMatch(dash, /<table/);
    });

    test('formulaire d’événement : étapes numérotées, état courant et terminé, un seul grand bouton', () => {
        const form = read('components/events/EventForm.tsx');
        assert.match(form, /<nav aria-label="Étapes du formulaire"[^>]*data-testid="ev-stepper"/);
        assert.match(form, /`Étape \$\{stepIndex \+ 1\} sur \$\{STEPS\.length\} — \$\{currentStep\.heading\}`/);
        assert.match(form, /aria-current=\{active \? 'step' : undefined\}/);
        assert.match(form, /\(terminée\)/);
        assert.equal((form.match(/variant="gradient"/g) ?? []).length, 1, 'un seul grand bouton en dégradé');
        assert.match(form, /variant="gradient"[\s\S]{0,400}?\n\s+Envoyer pour validation\n/);
    });
});
