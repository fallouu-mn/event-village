/**
 * Finition 3b (administration claire) — écrans, contrôle statique (sans base). Grandit avec chaque point de la finition.
 *  1. Accueil (E-29) : « À faire aujourd'hui » en tête, avant « Argent qui attend » (ancre #argent-qui-attend), lu par
 *     GET /api/admin/todo ; textes exacts « Rien d'urgent aujourd'hui. » et « Vous n'avez encore aucun droit : demandez-les
 *     au super-administrateur. » ; une phrase et un bouton par ligne ; « Compteur indisponible », jamais 0 ; plus de bloc
 *     « À traiter » ; onglets des candidatures comptés par GET /api/admin/partners (plus par les indicateurs) ; indicateurs
 *     seulement avec statistics.read, sinon le refus nomme la permission (plus « Vérifiez votre connexion »).
 * Sans base : aucune écriture, donc aucun appel d'invariants (écart signalé).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MIGRATED_DESIGN_FILES } from '../helpers/design-files';

const ROOT = process.cwd();
const read = (rel: string): string => {
    const file = path.join(ROOT, rel);
    assert.ok(fs.existsSync(file), `${rel} absent`);
    return fs.readFileSync(file, 'utf8');
};
/** Code sans commentaires (les commentaires peuvent citer d'anciens textes). */
const code = (rel: string): string => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
/** Texte d'écran normalisé : apostrophe typographique. */
const norm = (s: string): string => s.replace(/'/g, '’');

const DASHBOARD = 'app/admin/dashboard/page.tsx';
const TODO = 'components/admin/TodoToday.tsx';

describe('1. E-29 — « À faire aujourd’hui » en tête de l’accueil', () => {
    test('rendu en tête, avant « Argent qui attend » (ancre), plus de bloc « À traiter »', () => {
        const dash = code(DASHBOARD);
        const todo = dash.indexOf('<TodoToday');
        const money = dash.indexOf('<MoneyWaiting');
        assert.ok(todo > 0, `${DASHBOARD} ne rend pas <TodoToday>`);
        assert.ok(money < 0 || todo < money, '« À faire aujourd’hui » doit précéder « Argent qui attend »');
        assert.match(dash, /id="argent-qui-attend"/, 'ancre #argent-qui-attend absente');
        assert.doesNotMatch(dash, />\s*À traiter\s*</, 'bloc « À traiter » encore rendu');
    });

    test('une seule route serveur, textes exacts de la consigne, jamais 0 pour un compteur illisible', () => {
        const c = code(TODO);
        assert.match(c, /'\/api\/admin\/todo'/, 'GET /api/admin/todo non lu');
        assert.ok(norm(c).includes(norm("Rien d'urgent aujourd'hui.")), '« Rien d’urgent aujourd’hui. » absent');
        assert.ok(norm(c).includes(norm("Vous n'avez encore aucun droit : demandez-les au super-administrateur.")), 'texte « aucun droit » absent');
        assert.ok(c.includes('Compteur indisponible pour le moment.'), '« Compteur indisponible » absent');
        assert.match(c, /\/admin\/mes-droits/, 'lien « Voir mes droits » absent');
        for (const key of ['to_resume', 'events_to_validate', 'partners_to_validate', 'events_suspended', 'cash_discrepancies', 'failed_sends', 'sms_cap', 'debts']) {
            assert.match(c, new RegExp(`\\b${key}: \\{`), `ligne ${key} sans texte ni bouton`);
        }
        assert.match(c, /#argent-qui-attend/, 'versements à reprendre : lien vers « Argent qui attend » absent');
    });

    test('candidatures comptées sans statistics.read ; indicateurs seulement avec statistics.read', () => {
        const dash = code(DASHBOARD);
        assert.doesNotMatch(dash, /count: kpis\?\.(pending|validated|rejected|total)Partners/, 'onglets des candidatures encore comptés par les indicateurs');
        assert.match(dash, /partnerCounts\?\.EN_ATTENTE/, 'onglets des candidatures : nombre lu par GET /api/admin/partners');
        assert.match(dash, /hasPermission\('statistics\.read'\)/, 'indicateurs lus sans tester statistics.read');
        assert.match(dash, /permissionMissingMessage\('statistics\.read'\)/, 'refus des indicateurs sans nommer la permission');
        assert.doesNotMatch(dash, /indicateurs de la plateforme\. Vérifiez votre connexion/, 'refus de droit des indicateurs présenté comme une panne de réseau');
    });

    test('nouveau composant dans la liste du système de design', () => {
        assert.ok(MIGRATED_DESIGN_FILES.includes(TODO), `${TODO} absent de tests/helpers/design-files.ts`);
    });
});

// ── 2. Menu selon les droits et « Mes droits » (E-34) ───────────────────────────────────────────────────────────────

type NavItem = { name: string; href: string; short?: string };
type AdminNav = { groups: Array<{ label: string; items: NavItem[] }>; proItems: NavItem[]; mobile: NavItem[] };
const NAV_MODULE = 'components/layout/admin-nav.ts';

async function navFor(perms: string[], superadmin = false): Promise<AdminNav> {
    const mod = (await import(path.join(ROOT, NAV_MODULE))) as { buildAdminNav: (can: (p: string) => boolean, isSuperAdmin: boolean) => AdminNav };
    return mod.buildAdminNav((p) => superadmin || perms.includes(p), superadmin);
}
const hrefs = (nav: AdminNav): string[] => nav.groups.flatMap((g) => g.items.map((i) => i.href));

describe('2. E-34 — menu et barre du bas selon les droits ; « Mes droits »', () => {
    test('AppLayout charge le menu de l’administration à la demande (module à part), plus aucune entrée admin en dur', () => {
        const layout = code('components/layout/AppLayout.tsx');
        assert.match(layout, /import\(\s*'\.\/admin-nav'\s*\)/, 'AppLayout ne charge pas ./admin-nav à la demande');
        for (const href of ['/admin/pricing', '/admin/communications', '/admin/referral', '/admin/notifications', '/scan']) {
            assert.ok(!layout.includes(`'${href}'`), `entrée ${href} encore écrite dans AppLayout`);
        }
    });

    test('ADMIN sans aucun droit : seulement l’accueil et « Mes droits »', async () => {
        const nav = await navFor([]);
        assert.deepEqual(hrefs(nav), ['/admin/mes-droits']);
        assert.deepEqual(nav.mobile.map((i) => i.href), ['/admin/dashboard']);
        assert.deepEqual(nav.proItems.map((i) => i.href), ['/admin/dashboard', '/admin/mes-droits']);
    });

    test('ADMIN events.read et events.write : Événements, Catalogues et services, Mes droits, rien d’autre', async () => {
        const nav = await navFor(['events.read', 'events.write']);
        assert.deepEqual(hrefs(nav), ['/admin/events', '/admin/services', '/admin/mes-droits']);
        assert.deepEqual(nav.mobile.map((i) => i.href), ['/admin/dashboard', '/admin/events']);
    });

    test('chaque entrée suit son droit ; « Scanner » seulement avec access.operate ; « Réglages » avec settings.read', async () => {
        const cases: Array<[string[], string[]]> = [
            [['users.read'], ['/admin/users', '/admin/referral']],
            [['referrals.manage'], ['/admin/referral']],
            [['payments.read'], ['/admin/finance']],
            [['refunds.manage'], ['/admin/finance']],
            [['communications.manage'], ['/admin/communications']],
            [['notifications.read'], ['/admin/notifications']],
            [['settings.read'], ['/admin/finance-settings']],
            [['access.operate'], ['/scan']],
            [['statistics.read', 'partners.read', 'partners.validate'], []],
        ];
        for (const [perms, expected] of cases) {
            const got = hrefs(await navFor(perms)).filter((h) => h !== '/admin/mes-droits');
            assert.deepEqual(got, expected, `droits ${perms.join(', ')}`);
        }
    });

    test('SUPERADMIN : tout, journal d’audit compris, sans « Mes droits » ni « Tarification »', async () => {
        const nav = await navFor([], true);
        assert.deepEqual(hrefs(nav), ['/admin/events', '/admin/users', '/admin/services', '/admin/finance', '/admin/referral',
            '/admin/communications', '/admin/finance-settings', '/admin/audit', '/admin/notifications', '/scan']);
        assert.deepEqual(nav.mobile.map((i) => i.href), ['/admin/dashboard', '/admin/events', '/admin/users', '/admin/finance', '/admin/audit']);
        assert.ok(!JSON.stringify(nav).includes('/admin/pricing'), '« Tarification » encore au menu');
    });

    test('page « Mes droits » : ce que l’admin peut faire et ne pas faire, en phrases ; texte exact sans aucun droit', () => {
        const page = code('app/admin/mes-droits/page.tsx');
        assert.ok(norm(page).includes(norm("Vous n'avez encore aucun droit : demandez-les au super-administrateur.")), 'texte « aucun droit » absent');
        for (const t of ['Vous pouvez', 'Vous ne pouvez pas']) assert.ok(page.includes(t), `rubrique « ${t} » absente`);
        assert.match(page, /permissionDescription\(/, 'chaque droit sans sa phrase');
        assert.ok(MIGRATED_DESIGN_FILES.includes('app/admin/mes-droits/page.tsx'), 'page absente de la liste du système de design');
        const labels = read('lib/admin/permission-labels.ts');
        assert.match(labels, /export function permissionDescription\(/, 'phrases des droits absentes');
    });
});

// ── 3. Réglages de la plateforme (E-35) ──────────────────────────────────────────────────────────────────────────

const SETTINGS_PAGE = 'app/admin/finance-settings/page.tsx';

describe('3. E-35 — réglages groupés, expliqués, bornés à l’écran, confirmés « Avant → Après »', () => {
    test('sommaire des thèmes avec ancres ; une phrase, la valeur par défaut et l’alerte de chaque réglage', () => {
        const page = code(SETTINGS_PAGE);
        assert.match(page, /aria-label="Sommaire des réglages"/, 'sommaire absent');
        for (const anchor of ['finance', 'controle', 'support', 'notifications', 'services']) {
            assert.match(page + code('lib/settings/catalog.ts'), new RegExp(`anchor: '${anchor}'`), `ancre #${anchor} absente`);
        }
        assert.match(page, /Par défaut :/, 'valeur par défaut non affichée');
        assert.match(page, /settingRisk\(/, 'alerte des valeurs risquées absente');
    });

    test('bornes vérifiées à l’écran avant l’envoi (erreur sous le champ) ; confirmation « Avant → Après » avec le motif', () => {
        const page = code(SETTINGS_PAGE);
        assert.match(page, /settingBoundsError\(/, 'bornes non vérifiées à l’écran');
        assert.match(page, /<ConfirmDialog\b/, 'aucune confirmation avant l’enregistrement');
        assert.match(page, /→/, 'confirmation sans « Avant → Après »');
        assert.match(page, /S’applique aux opérations faites à partir de maintenant ; le passé ne change pas\. Personne n’est prévenu\./, 'conséquence du changement absente');
        assert.match(page, /Motif/, 'motif absent de la confirmation');
    });

    test('historique : qui, quoi, quand, pourquoi ; plus de clé technique à l’écran', () => {
        const page = code(SETTINGS_PAGE);
        assert.match(page, /\.author\b/, 'auteur des changements non affiché');
        assert.doesNotMatch(page, />\s*\{\s*h\.key\s*\}\s*</, 'clé technique affichée dans l’historique');
        const catalog = read('lib/settings/catalog.ts');
        assert.match(catalog, /export const SETTING_BOUNDS/, 'catalogue des bornes absent');
        assert.match(catalog, /export function settingBoundsError\(/, 'contrôle des bornes absent');
        assert.match(catalog, /export function settingRisk\(/, 'alertes absentes');
    });
});

describe('3 bis. garde-fou : un seul libellé par réglage (page et catalogue des bornes)', () => {
    test('chaque réglage borné a le même libellé et la même unité sur la page et dans lib/settings/catalog.ts', async () => {
        const page = read(SETTINGS_PAGE);
        const { SETTING_BOUNDS } = (await import(path.join(ROOT, 'lib/settings/catalog.ts'))) as { SETTING_BOUNDS: Record<string, { label: string; unit?: string }> };
        const faults: string[] = [];
        for (const [key, b] of Object.entries(SETTING_BOUNDS)) {
            const line = page.split(String.fromCharCode(10)).find((l) => l.includes(`'${key}': { label:`));
            if (!line) { faults.push(`${key} : absent de la page`); continue; }
            const label = /label: '([^']*)'/.exec(line)?.[1];
            const unit = /unit: '([^']*)'/.exec(line)?.[1];
            if (label !== b.label) faults.push(`${key} : libellé « ${label} » (page) ≠ « ${b.label} » (catalogue)`);
            if ((unit ?? undefined) !== (b.unit ?? undefined)) faults.push(`${key} : unité ${unit} (page) ≠ ${b.unit} (catalogue)`);
        }
        assert.deepEqual(faults, [], faults.join(String.fromCharCode(10)));
    });
});

// ── 4. Création d'un administrateur et ses droits (E-36) ──────────────────────────────────────────────────────────

const USERS_PAGE = 'app/admin/users/page.tsx';

describe('4. E-36 — créer un administrateur enchaîne sur ses droits ; profils prêts ; dépendances', () => {
    test('après la création d’un ADMIN, la grille de ses droits s’ouvre (identifiant rendu par la route)', () => {
        const page = code(USERS_PAGE);
        assert.match(page, /reply\.userId/, 'identifiant du compte créé non lu');
        assert.match(page, /handleOpenPermissions\(/, 'grille des droits non ouverte');
        assert.match(page, /newRole === 'ADMIN'/, 'enchaînement réservé à la création d’un administrateur');
    });

    test('profils prêts, dépendances cochées d’office, cases accessibles groupées, phrase de chaque droit', () => {
        const page = code(USERS_PAGE);
        assert.match(page, /PERMISSION_PROFILES\.map\(/, 'profils prêts absents');
        assert.match(page, /withDependencies\(/, 'dépendances non appliquées');
        assert.match(page, /type="checkbox"/, 'cases à cocher absentes');
        assert.match(page, /<fieldset\b/, 'groupes de droits sans fieldset');
        assert.match(page, /<legend\b/, 'groupes de droits sans légende');
        assert.match(page, /permissionDescription\(/, 'droits sans leur phrase');
        assert.match(page, /Droits de \$\{/, 'titre « Droits de … » absent');
    });

    test('texte de création réécrit : lien d’activation par SMS valable 24 heures, aucun droit tant qu’on ne lui en donne pas', () => {
        const page = norm(code(USERS_PAGE));
        assert.ok(page.includes(norm('Le titulaire reçoit par SMS un lien d’activation valable 24 heures pour choisir son mot de passe.')), 'phrase du lien d’activation absente');
        assert.ok(page.includes(norm('Un administrateur n’a aucun droit tant que vous ne lui en donnez pas : vous les choisissez juste après la création.')), 'phrase « aucun droit » absente');
        for (const jargon of ['Permissions Granulaires', 'Console Superadmin HQ', 'RBAC', 'Accès maître absolu HQ', 'Routage :', 'CLIENT STANDARD', 'Créer un Compte Métier']) {
            assert.ok(!page.includes(jargon), `jargon encore à l’écran : « ${jargon} »`);
        }
    });
});
