/**
 * Lot 9 bis, tâche 41 (contrat 5.41 ; B85 à B95 ; découverte D-txt 2 et 3) — textes de l'application, contrôle statique.
 *  - R75 : plus de mot technique montré : « Code OTP », « Pièce « ${docType} », « (${smsRefusal », « au statut ${ »,
 *    « SamirPay (${ » absents de app/, lib/, components/ (commentaires et journaux console exclus) ;
 *  - R76 : docs/glossaire.md existe ; les termes écartés ont quitté les fichiers relevés (D-txt 3) ; le numéro invalide
 *    vient d'une seule constante INVALID_SN_PHONE_MESSAGE, importée par les six écrans et routes relevés ;
 *  - R97 : plus de « sa session est fermée », plus de champ Email dans les deux écrans d'invitation, plus des trois
 *    textes périmés de l'onglet Caisse ;
 *  - R100 : « rien n’est validé » réservé au hors-ligne dans le scanner ; QR expiré « demandez au client d’ouvrir son
 *    billet dans l’application » ; R107 : refus 403 du scan « Vous ne contrôlez plus cet événement », traité par le scanner ;
 *  - R21 : /admin/pricing sans `handleSaveSection(`, sans Wave, sans « (§11 » ;
 *  - R67 : /admin/referral sans « 24 Mois » ni « N1 7% » codés en dur ;
 *  - R70 : aucune adresse `@event-village.sn` ni `support@eventvillage.sn` écrite hors lib/support.ts (et .env.example,
 *    hors du champ) ; lib/support.ts lit SUPPORT_EMAIL ;
 *  - R88 : le résultat de verifyOtp est lu, et son échec mène à setErrorMessage sans navigation (connexion et récupération) ;
 *  - R92 : « Supprimer le brouillon » dépend de `can_delete`, plus de `status === 'BROUILLON'` ;
 *  - R104 : billets reçus : texte choisi par `kind` (invitation ou transfert) ;
 *  - R105 : onglet Aperçu avec un état suspendu ; fiche admin avec le lien « Ouvrir le pilotage » ;
 *  - R81 (tâche 46) : témoin vert, event_notify supprimée (M/20261103000005:1199) et jamais redéfinie : non reproduit.
 *
 * Rouge avant correctif : chaque chaîne est présente aujourd'hui (fichier:ligne dans chaque message) ; lib/support.ts et
 * docs/glossaire.md n'existent pas. Fichiers sans propriétaire de correctif au contrat 8.2, signalés au rapport :
 * `app/api/tickets/route.ts:141` (« Pass Standard », fichier de S-C) et `app/api/auth/register/start/route.ts:39` (numéro
 * invalide), tous deux cités par D-txt 3.
 * Exception documentée (R75) : `app/api/auth/sms-hook/route.ts` répond au service d'authentification, jamais à une
 * personne ; sa réponse « Code OTP absent ou invalide. » n'entre pas dans le contrôle.
 * Suite sans base et sans écriture : aucune aide d'invariants en after() (signalé).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_DIRS = ['app', 'lib', 'components'];

function abs(rel: string): string {
    return path.join(ROOT, ...rel.split('/'));
}

function read(rel: string): string {
    assert.ok(fs.existsSync(abs(rel)), `${rel} absent : le contrôle ne prouverait rien`);
    return fs.readFileSync(abs(rel), 'utf8');
}

/**
 * Source sans commentaires, lignes conservées (un bloc devient des lignes blanches) : un numéro de ligne reste juste.
 * Les URL `https://` et les chaînes qui contiennent « // » sont gardées.
 */
function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');
}

/** Journal console : jamais montré à une personne. */
const CONSOLE_RE = /\bconsole\.(?:log|warn|error|info|debug)\s*\(/;

/** Apostrophes et espaces insécables ramenés à leur forme simple. */
function norm(s: string): string {
    return s.replace(/[’‘]/g, '\'').replace(/[  ]/g, ' ');
}

function walk(dir: string, out: string[]): void {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
            walk(full, out);
        } else if (/\.(?:ts|tsx|js|mjs)$/.test(e.name)) out.push(full);
    }
}

function sourceFiles(): string[] {
    const out: string[] = [];
    for (const d of SOURCE_DIRS) walk(abs(d), out);
    assert.ok(out.length > 200, `parcours trop court : ${out.length} fichiers`);
    return out;
}

function rel(full: string): string {
    return path.relative(ROOT, full).split(path.sep).join('/');
}

/** Occurrences « fichier:ligne : texte » d'un motif dans le code visible de app/, lib/, components/. */
function hits(pattern: RegExp, exclude: string[] = []): string[] {
    const out: string[] = [];
    for (const full of sourceFiles()) {
        const r = rel(full);
        if (exclude.includes(r)) continue;
        stripComments(fs.readFileSync(full, 'utf8')).split('\n').forEach((line, i) => {
            if (pattern.test(line) && !CONSOLE_RE.test(line)) out.push(`${r}:${i + 1} : ${line.trim().slice(0, 160)}`);
        });
    }
    return out;
}

// ── R75 : mots techniques ──────────────────────────────────────────────────

describe('R75 — aucun mot technique montré à une personne', () => {
    const FORBIDDEN: Array<[string, RegExp]> = [
        ['Code OTP', /Code OTP/],
        ['Pièce « ${docType}', /Pièce « \$\{docType\}/],
        ['(${smsRefusal', /\(\$\{smsRefusal/],
        ['au statut ${', /au statut \$\{/],
        ['SamirPay (${', /SamirPay \(\$\{/],
    ];

    for (const [label, re] of FORBIDDEN) {
        test(`« ${label} » absent de app/, lib/, components/ (hors commentaires et journaux)`, () => {
            assert.deepEqual(hits(re, ['app/api/auth/sms-hook/route.ts']), [], `« ${label} » encore montré`);
        });
    }

    test('lib/auth/otp-store.ts : « Le code a expiré » sans « OTP » (aujourd’hui :108)', () => {
        const src = norm(read('lib/auth/otp-store.ts'));
        assert.ok(!src.includes('Le code OTP a expiré'), 'lib/auth/otp-store.ts:108 : « Le code OTP a expiré » encore présent');
    });
});

// ── R76 : glossaire ────────────────────────────────────────────────────────

describe('R76 — un seul nom par objet (docs/glossaire.md)', () => {
    test('docs/glossaire.md existe et retient les termes du lot (catégorie, partenaire, organisateur, Portefeuille, Valable, F CFA)', () => {
        const doc = read('docs/glossaire.md');
        for (const term of ['catégorie', 'quantité mise en vente', 'partenaire', 'organisateur', 'Portefeuille', 'Valable', 'F CFA', 'Réglages de la plateforme']) {
            assert.ok(doc.includes(term), `docs/glossaire.md : terme retenu « ${term} » absent`);
        }
    });

    const REMOVED: Array<[string, RegExp, string]> = [
        ['app/partner/dashboard/page.tsx', /Espace organisateur/, '« Espace organisateur » (:232) → « Espace partenaire »'],
        ['app/page.tsx', /label:\s*'Devenir organisateur'/, 'lien « Devenir organisateur » (:369) → « Devenir partenaire »'],
        ['app/events/[id]/page.tsx', /Aucune formule/, '« Aucune formule n’est en vente » (:1077) → « catégorie »'],
        ['app/api/tickets/route.ts', /Pass Standard/, 'repli « Pass Standard » (:141) → « Catégorie inconnue »'],
        ['lib/messages/toast-messages.ts', /a été rejetée/, 'toast « a été rejetée » (:12) → « refusée »'],
        ['app/profile/page.tsx', /Portefeuille et parrainage/, '« Portefeuille et parrainage » (:174) → « Portefeuille de parrainage »'],
        ['components/layout/AppLayout.tsx', /short:\s*'Solde'/, 'barre du bas « Solde » (:134) → « Portefeuille »'],
    ];
    for (const [file, re, label] of REMOVED) {
        test(`${file} : terme écarté absent — ${label}`, () => {
            const found = stripComments(read(file)).split('\n').map((l, i) => [i + 1, l] as const).filter(([, l]) => re.test(l));
            assert.deepEqual(found.map(([n, l]) => `${file}:${n} : ${l.trim()}`), [], label);
        });
    }

    const PHONE_FILES = [
        'app/api/auth/register/start/route.ts',
        'components/auth/LoginForm.tsx',
        'components/profile/PhoneChangeDialog.tsx',
        'app/api/partner/team/invite/route.ts',
        'app/forgot-password/page.tsx',
    ];

    test('numéro invalide : une seule constante INVALID_SN_PHONE_MESSAGE dans lib/validations/auth.ts', () => {
        const src = norm(read('lib/validations/auth.ts'));
        const m = /export const INVALID_SN_PHONE_MESSAGE\s*=\s*'([^']*)'/.exec(src);
        assert.ok(m, 'lib/validations/auth.ts : export const INVALID_SN_PHONE_MESSAGE absent');
        assert.equal(m[1], 'Numéro de mobile sénégalais invalide. Exemple : 77 123 45 67.', 'texte retenu par le glossaire (D-txt 3)');
        assert.ok(!/message:\s*'Numéro de téléphone sénégalais invalide \(ex/.test(src), 'lib/validations/auth.ts:49 : ancien texte encore écrit');
    });

    for (const file of PHONE_FILES) {
        test(`${file} : numéro invalide par INVALID_SN_PHONE_MESSAGE, sans texte propre`, () => {
            const src = stripComments(read(file));
            assert.match(src, /\bINVALID_SN_PHONE_MESSAGE\b/, `${file} : la constante n’est pas employée`);
            const own = src.split('\n').filter((l) => /sénégalais (?:in)?valide/.test(l) && !/adresse email ou un numéro/.test(l));
            assert.deepEqual(own.map((l) => l.trim()), [], `${file} : texte de numéro invalide écrit sur place`);
        });
    }
});

// ── R97 : équipe et caisse ─────────────────────────────────────────────────

describe('R97 — textes de l’équipe et de la caisse', () => {
    test('app/partner/team/page.tsx : plus de « sa session est fermée » (:648), plus de champ Email (:724)', () => {
        const src = read('app/partner/team/page.tsx');
        assert.ok(!src.includes('sa session est fermée'), 'app/partner/team/page.tsx:648 : « sa session est fermée » (faux s’il contrôle pour un autre organisateur)');
        assert.ok(!src.includes('label="Email"'), 'app/partner/team/page.tsx:724 : champ Email ignoré par la route');
    });

    test('components/partner/pilotage/TeamTab.tsx : plus de champ Email (:350)', () => {
        assert.ok(!read('components/partner/pilotage/TeamTab.tsx').includes('label="Email"'), 'TeamTab.tsx:350 : champ Email ignoré par la route');
    });

    test('components/partner/pilotage/CashTab.tsx : plus des trois textes périmés (:118, :120, :149)', () => {
        const src = norm(read('components/partner/pilotage/CashTab.tsx'));
        const stale = ['Au scan et au guichet, toutes caisses', 'Clôtures co-signées ou en litige', 'ne peuvent pas encore clôturer leur caisse'];
        assert.deepEqual(stale.filter((t) => src.includes(t)), [], 'textes périmés de l’onglet Caisse');
    });
});

// ── R100 et R107 : scanner ─────────────────────────────────────────────────

describe('R100 et R107 — textes du scanner', () => {
    test('components/scan/scan-client.ts : « rien n’est validé » seulement pour le hors-ligne (aujourd’hui :206, :351, :353)', () => {
        const lines = norm(read('components/scan/scan-client.ts')).split('\n');
        const wrong = lines.map((l, i) => [i + 1, l] as const)
            .filter(([, l]) => /rien n'est validé/.test(l) && !/Hors ligne : rien n'est validé/.test(l));
        assert.deepEqual(wrong.map(([n, l]) => `scan-client.ts:${n} : ${l.trim()}`), [], 'après un délai ou une coupure, le billet a pu être composté');
    });

    test('lib/scan/scan-result.ts : QR expiré « demandez au client d’ouvrir son billet dans l’application » (une capture ne se rafraîchit pas)', () => {
        const src = norm(read('lib/scan/scan-result.ts'));
        assert.ok(src.includes('QR expiré : demandez au client d\'ouvrir son billet dans l\'application'), 'lib/scan/scan-result.ts:56 : texte du QR expiré');
        assert.ok(!src.includes('rafraîchir son billet'), 'ancien texte « rafraîchir son billet » encore présent');
    });

    test('R107 : refus 403 du scan « Vous ne contrôlez plus cet événement », et le scanner y réagit', () => {
        const client = norm(read('components/scan/scan-client.ts'));
        assert.ok(client.includes('Vous ne contrôlez plus cet événement'), 'scan-client.ts:344-345 : « Contrôle non autorisé » au lieu de « Vous ne contrôlez plus cet événement »');
        assert.match(stripComments(read('app/controller/scanner/page.tsx')), /'forbidden'/, 'app/controller/scanner/page.tsx : aucun traitement du refus forbidden (relecture des affectations)');
    });
});

// ── R21 et R67 : pages admin ───────────────────────────────────────────────

describe('R21 et R67 — pages admin sans effet ni valeur codée en dur', () => {
    test('app/admin/pricing/page.tsx : sans handleSaveSection(, sans Wave, sans « (§11 »', () => {
        const src = read('app/admin/pricing/page.tsx');
        const found: string[] = [];
        if (src.includes('handleSaveSection(')) found.push('handleSaveSection( (:143, :223, :273 : sections enregistrées et lues nulle part)');
        if (/wave/i.test(src)) found.push('Wave (:34 : 1,0 % alors que le moteur applique 1,5 %)');
        if (src.includes('(§11')) found.push('(§11… (:114, :137, :217, :267)');
        assert.deepEqual(found, [], 'sections de tarification sans effet');
    });

    test('app/admin/referral/page.tsx : sans « 24 Mois » ni « N1 7% » (durées et taux lus dans la configuration)', () => {
        const src = read('app/admin/referral/page.tsx');
        const found = ['24 Mois', 'N1 7%'].filter((t) => src.includes(t));
        assert.deepEqual(found, [], 'app/admin/referral/page.tsx:146, :151 : valeurs codées en dur');
    });
});

// ── R70 : adresse de support ───────────────────────────────────────────────

describe('R70 — une seule adresse de support, lue depuis SUPPORT_EMAIL', () => {
    test('aucune adresse @event-village.sn ni support@eventvillage.sn écrite hors lib/support.ts', () => {
        const found = hits(/@event-village\.sn|support@eventvillage\.sn/, ['lib/support.ts']);
        assert.deepEqual(found, [], `adresses écrites en dur (6 aujourd’hui) :\n${found.join('\n')}`);
    });

    test('lib/support.ts : adresse par défaut support@eventvillage.sn, surchargée par SUPPORT_EMAIL', () => {
        const src = read('lib/support.ts');
        assert.match(src, /support@eventvillage\.sn/, 'adresse par défaut');
        assert.match(src, /SUPPORT_EMAIL/, 'variable SUPPORT_EMAIL lue (lib/env.ts:114, déclarée et lue nulle part aujourd’hui)');
        assert.doesNotMatch(src, /NEXT_PUBLIC_SUPPORT/, 'jamais NEXT_PUBLIC_ (figée au build, L26)');
    });
});

// ── R88 : échec de session après le code ───────────────────────────────────

describe('R88 — échec de verifyOtp lu et dit, sans navigation', () => {
    const MESSAGE = 'Code accepté, mais la connexion n\'a pas pu s\'ouvrir. Demandez un nouveau code et réessayez.';
    const NAVIGATION = /window\.location|router\.(?:push|replace)\(|handlePostLoginRedirect\(|setItem\('ev_recovery_verified'/;

    for (const file of ['components/auth/LoginForm.tsx', 'app/forgot-password/page.tsx']) {
        test(`${file} : résultat de verifyOtp lu, échec → setErrorMessage et retour avant toute navigation`, () => {
            const src = norm(stripComments(read(file)));
            const calls = Array.from(src.matchAll(/\.auth\.verifyOtp\(/g)).map((m) => m.index ?? 0);
            assert.ok(calls.length > 0, `${file} : aucun appel à verifyOtp (contrôle sans objet)`);
            const issues: string[] = [];
            for (const at of calls) {
                const line = src.slice(0, at).split('\n').length;
                const before = src.slice(Math.max(0, at - 200), at).replace(/\s+/g, ' ');
                if (!/const \{[^}]*\} ?= ?await [\w.()]+$/.test(before)) issues.push(`appel à :${line} : résultat non lu (aucun « const { … } = await »)`);
                const rest = src.slice(at);
                const nav = rest.search(NAVIGATION);
                const span = nav < 0 ? rest.slice(0, 1500) : rest.slice(0, nav);
                if (!/setErrorMessage\(/.test(span) || !/\breturn\b/.test(span)) {
                    issues.push(`appel à :${line} : aucun setErrorMessage( suivi d’un return avant la navigation`);
                }
            }
            assert.deepEqual(issues, [], `${file} : ${issues.join(' ; ')}`);
            assert.ok(src.includes(MESSAGE), `${file} : message d’échec « ${MESSAGE} » absent`);
        });
    }
});

// ── R92, R104, R105 : écrans du partenaire et de l'admin ───────────────────

describe('R92, R104, R105 — écrans', () => {
    test('R92 : « Supprimer le brouillon » dépend de can_delete (PartnerEventCard.tsx:142)', () => {
        const src = stripComments(read('components/partner/events-list/PartnerEventCard.tsx'));
        const at = src.indexOf('Supprimer le brouillon');
        assert.ok(at > 0, 'bouton « Supprimer le brouillon » introuvable');
        const guard = src.slice(Math.max(0, at - 400), at);
        assert.doesNotMatch(guard, /status\s*===\s*'BROUILLON'/, 'bouton affiché pour tout BROUILLON, même déjà soumis (refusé ensuite par events_delete_guard)');
        assert.match(guard, /can_delete/, 'bouton non conditionné par can_delete');
    });

    test('R104 : IncomingTransfers.tsx choisit le texte par kind (invitation ou transfert)', () => {
        const src = stripComments(read('components/tickets/IncomingTransfers.tsx'));
        assert.match(src, /\bkind\b/, 'aucune lecture de kind : textes de transfert appliqués à une invitation (:205, :286)');
        assert.match(src, /'INVITATION'/, 'cas INVITATION absent');
    });

    test('R105 : OverviewTab connaît l’état suspendu (« Places en vente » pendant une suspension)', () => {
        const src = stripComments(read('components/partner/pilotage/OverviewTab.tsx'));
        assert.match(src, /SUSPENDED/, 'aucun état SUSPENDED : seul saleStopped (annulation) est connu (:15, :40)');
        assert.match(src, /Suspendue/, 'carte « Vente » « Suspendue » absente');
    });

    test('R105 : la fiche admin d’un événement ouvre le pilotage', () => {
        const src = norm(stripComments(read('app/admin/events/[id]/page.tsx')));
        assert.match(src, /\/partner\/events\/\$\{/, 'aucun lien vers /partner/events/{id}');
        assert.ok(src.includes('Ouvrir le pilotage'), 'libellé « Ouvrir le pilotage » absent');
    });
});

// ── R81 (tâche 46) : event_notify, non reproduit ───────────────────────────

describe('R81 — event_notify supprimée, aucune redéfinition (témoin vert, constat non reproduit)', () => {
    const MIGRATIONS = path.join('supabase', 'migrations');
    const DROP_FILE = '20261103000005_lot6_billetterie.sql';

    test('M/20261103000005 supprime event_notify et aucune migration plus récente ne la redéfinit', () => {
        const files = fs.readdirSync(abs(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort();
        const drop = files.find((f) => f.startsWith('20261103000005'));
        assert.ok(drop, `migration 20261103000005 introuvable (attendue : ${DROP_FILE})`);
        assert.match(read(`supabase/migrations/${drop}`), /DROP FUNCTION IF EXISTS public\.event_notify\(uuid\[\], text, text, jsonb\);/, 'suppression de event_notify (:1199)');
        const later = files.filter((f) => f > drop);
        assert.ok(later.length > 10, `migrations postérieures lues : ${later.length}`);
        const redefined = later.filter((f) => /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?event_notify\s*\(/i.test(read(`supabase/migrations/${f}`)));
        assert.deepEqual(redefined, [], 'event_notify redéfinie après sa suppression');
    });
});
