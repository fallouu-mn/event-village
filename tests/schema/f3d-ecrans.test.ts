/**
 * Finition 3d (recours et suppléance) — écrans, sans base (lecture des fichiers et fonctions pures). Aucune écriture,
 * donc aucun appel d'invariants (même règle que f3b-ecrans).
 *
 * 4b. Page Équipe d'un admin : la liste avec recherche (OrganizerPicker) remplace « ?partnerId= » tapé à la main ; lien
 *     « Équipe de cet événement » sur la fiche admin d'un événement (onglet Équipe du pilotage).
 * 4c. Écart de caisse : la route et la base laissent valider un admin events.write depuis la 2a, mais l'écran cachait la
 *     section « Écarts à valider » à tout admin (run 291) : elle s'affiche désormais pour la propriétaire, le SUPERADMIN et
 *     un admin events.write (même règle que « Fermer cette caisse »).
 * 5. Accueil (décision 12 de la 3b) : « Argent qui attend » garde le détail ; « À faire aujourd'hui » n'a plus qu'une
 *    ligne pour l'argent : « Argent qui attend : {n} versements à reprendre, {n} créances », qui mène au bloc
 *    (#argent-qui-attend). Composition dans une fonction pure (todoMoneyLine, lib/admin/todo.ts) : seules les parties
 *    ouvertes aux droits de l'administrateur ; un compteur illisible le dit, jamais 0 ; tout à zéro → groupe « À jour ».
 * 2. Téléphone perdu, écrans : « J'ai perdu mon téléphone » dans la fenêtre du code administrateur (mot de passe et code de
 *    secours, puis la page « Sécurité du compte » pour changer son numéro) ; proposition des codes de secours après la
 *    double vérification ; page « Sécurité du compte » au menu du SUPERADMIN seulement ; codes montrés une seule fois avec
 *    « Imprimez-les ou notez-les en lieu sûr » ; « Changer le numéro » sur la ligne d'un ADMIN ; « fait » seulement sur la
 *    réponse du serveur.
 * 3. Changer le rôle, écrans : bouton sur la ligne d'un compte pour le SUPERADMIN, « fait » seulement si le serveur rend le
 *    rôle demandé ; plus de choix « Superadmin » à la création d'un compte.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

interface MoneyPart { key: 'to_resume' | 'debts'; count: number | null; amount: number | null; unavailable: boolean }
interface MoneyLine { due: boolean; title: string; parts: MoneyPart[] }
type Reply = { lines: Array<Record<string, unknown>>; upToDate: string[]; allowed: string[]; partial: boolean; computedAt: string | null };

async function moneyLineFn(): Promise<(reply: Reply) => MoneyLine | null> {
    const mod = (await import('../../lib/admin/todo')) as Record<string, unknown>;
    assert.equal(typeof mod.todoMoneyLine, 'function', 'todoMoneyLine absente de lib/admin/todo.ts');
    return mod.todoMoneyLine as (reply: Reply) => MoneyLine | null;
}

const reply = (allowed: string[], lines: Array<Record<string, unknown>>, upToDate: string[]): Reply =>
    ({ lines, upToDate, allowed, partial: false, computedAt: null });

describe('4b. Équipe d’un admin : choix de l’organisatrice et lien depuis la fiche d’un événement', () => {
    test('page Équipe : un admin sans organisatrice choisie voit la liste avec recherche (plus de « ?partnerId= » à taper)', () => {
        const page = read('app/partner/team/page.tsx');
        assert.match(page, /<OrganizerPicker\b/, 'la page Équipe doit proposer OrganizerPicker à un admin');
        assert.match(page, /Changer d’organisatrice/, 'un admin doit pouvoir revenir à la liste');
        const picker = read('components/partner/team/OrganizerPicker.tsx');
        assert.match(picker, /[`'"]\/api\/partner\/team\/organizers/, 'la liste doit lire GET /api/partner/team/organizers');
        assert.match(picker, /type="search"|inputMode="search"/, 'champ de recherche absent');
        assert.match(picker, /Aucune organisatrice ne correspond/, 'état vide de la recherche absent');
    });

    test('fiche admin d’un événement : lien « Équipe de cet événement » vers l’onglet Équipe du pilotage', () => {
        const sheet = read('app/admin/events/[id]/page.tsx');
        assert.match(sheet, /\/partner\/events\/\$\{event\.id\}\?tab=equipe/, 'lien vers l’onglet Équipe absent');
        assert.match(sheet, /Équipe de cet événement/);
    });
});

describe('4c. écart de caisse : « Valider l’écart » à l’écran d’un admin events.write', () => {
    test('la section « Écarts à valider » s’affiche pour la propriétaire, le SUPERADMIN et un admin events.write', () => {
        const cash = read('components/partner/pilotage/CashTab.tsx');
        // Avant la 3d : {!hasAnyRole(['ADMIN', 'SUPERADMIN']) && <DiscrepancyValidation …/>} : cachée à tout admin, alors que la
        // route et la base laissent valider un admin events.write depuis la 2a.
        assert.doesNotMatch(cash, /!hasAnyRole\(\['ADMIN', 'SUPERADMIN'\]\) && <DiscrepancyValidation/, 'section cachée à tout administrateur');
        const render = /\{(\w+) && <DiscrepancyValidation\b/.exec(cash);
        assert.ok(render, 'la section doit dépendre d’un seul booléen nommé');
        const decl = new RegExp(`const ${render[1]} = ([^;]+);`).exec(cash);
        assert.ok(decl, `déclaration de ${render[1]} absente`);
        assert.match(decl[1], /!hasAnyRole\(\['ADMIN', 'SUPERADMIN'\]\)/, 'la propriétaire (compte non admin) doit garder la section');
        assert.match(decl[1], /hasRole\('SUPERADMIN'\)/, 'le SUPERADMIN doit voir la section');
        assert.match(decl[1], /hasPermission\('events\.write'\)/, 'un admin events.write doit voir la section');
        const start = cash.indexOf('function DiscrepancyValidation');
        const end = cash.indexOf('\nfunction ', start + 10);
        assert.match(cash.slice(start, end === -1 ? undefined : end), /Valider l’écart/);
        assert.match(read('app/partner/events/[id]/page.tsx'), /\{ id: 'caisse', label: 'Caisse' \}/, 'onglet Caisse proposé à tous');
    });
});

describe('5. accueil : une seule ligne pour l’argent dans « À faire aujourd’hui »', () => {
    test('versements et créances : « Argent qui attend : 2 versements à reprendre, 3 créances »', async () => {
        const fn = await moneyLineFn();
        const line = fn(reply(['to_resume', 'events_to_validate', 'debts'],
            [{ key: 'to_resume', count: 2, amount: 17_850 }, { key: 'debts', count: 3, amount: 12_450 }], ['events_to_validate']));
        assert.ok(line);
        assert.equal(line.due, true);
        assert.equal(line.title, 'Argent qui attend : 2 versements à reprendre, 3 créances');
    });

    test('un versement, aucune créance : singulier et « aucune créance »', async () => {
        const fn = await moneyLineFn();
        const line = fn(reply(['to_resume', 'debts'], [{ key: 'to_resume', count: 1, amount: 5_000 }], ['debts']));
        assert.equal(line?.title, 'Argent qui attend : 1 versement à reprendre, aucune créance');
        assert.equal(line?.due, true);
    });

    test('seulement le droit de lire les créances : la partie des versements n’apparaît pas', async () => {
        const fn = await moneyLineFn();
        const line = fn(reply(['debts'], [{ key: 'debts', count: 1, amount: 900 }], []));
        assert.equal(line?.title, 'Argent qui attend : 1 créance');
    });

    test('tout à zéro : ligne « À jour », jamais une carte', async () => {
        const fn = await moneyLineFn();
        const line = fn(reply(['to_resume', 'debts'], [], ['to_resume', 'debts']));
        assert.equal(line?.due, false);
        assert.equal(line?.title, 'Argent qui attend : aucun versement à reprendre, aucune créance');
    });

    test('compteur illisible : dit, jamais 0, et la carte reste affichée', async () => {
        const fn = await moneyLineFn();
        const line = fn(reply(['to_resume', 'debts'], [{ key: 'to_resume', unavailable: true }], ['debts']));
        assert.equal(line?.due, true);
        assert.equal(line?.title, 'Argent qui attend : versements à reprendre (compteur indisponible), aucune créance');
    });

    test('aucun des deux droits : pas de ligne pour l’argent', async () => {
        const fn = await moneyLineFn();
        assert.equal(fn(reply(['events_to_validate'], [], ['events_to_validate'])), null);
    });

    test('TodoToday : une seule carte pour l’argent, qui mène au bloc « Argent qui attend »', () => {
        const src = read('components/admin/TodoToday.tsx');
        assert.match(src, /todoMoneyLine\(/, 'TodoToday doit composer la ligne de l’argent par todoMoneyLine');
        assert.match(src, /MONEY_KEYS/, 'les lignes to_resume et debts doivent sortir de la liste des cartes');
        assert.match(src, /["']#argent-qui-attend["']/, 'le bouton doit mener au bloc « Argent qui attend »');
        assert.match(src, /Voir l’argent qui attend/);
    });
});

// ── 2. Téléphone perdu : écrans ───────────────────────────────────────────────────────────────────────────────────

type NavItem = { name: string; href: string };
type AdminNav = { groups: Array<{ label: string; items: NavItem[] }>; proItems: NavItem[]; mobile: NavItem[] };

async function navHrefs(perms: string[], superadmin: boolean): Promise<{ menu: string[]; pro: string[] }> {
    const mod = (await import('../../components/layout/admin-nav')) as { buildAdminNav: (can: (p: string) => boolean, s: boolean) => AdminNav };
    const nav = mod.buildAdminNav((p) => superadmin || perms.includes(p), superadmin);
    return { menu: nav.groups.flatMap((g) => g.items.map((i) => i.href)), pro: nav.proItems.map((i) => i.href) };
}

describe('2. téléphone perdu : écrans', () => {
    test('fenêtre du code administrateur : « J’ai perdu mon téléphone », mot de passe et code de secours, puis la page Sécurité', () => {
        const gate = read('components/admin/AdminStepUpGate.tsx');
        assert.match(gate, /J’ai perdu mon téléphone/, 'lien « J’ai perdu mon téléphone » absent');
        assert.match(gate, /['"]\/api\/admin\/step-up\/recovery['"]/, 'le code de secours doit passer par /api/admin/step-up/recovery');
        assert.match(gate, /Code de secours/, 'champ « Code de secours » absent');
        assert.match(gate, /autoComplete="current-password"/);
        assert.match(gate, /['"]\/admin\/securite\?numero=1['"]/, 'après le code de secours, la page Sécurité doit mener au changement de numéro');
        assert.match(gate, /reply\.ok === true/, 'la suite ne doit venir que sur la réponse du serveur');
        assert.match(gate, /Demandez au Superadmin de changer votre numéro/, 'un ADMIN doit être invité à s’adresser au Superadmin');
    });

    test('après la double vérification, un SUPERADMIN sans codes de secours se les voit proposer', () => {
        const gate = read('components/admin/AdminStepUpGate.tsx');
        assert.match(gate, /Créez vos codes de secours/);
        assert.match(gate, /['"]\/admin\/securite\?creer=1['"]/);
        assert.match(gate, /Plus tard/);
        assert.match(gate, /wasSms && hasRole\('SUPERADMIN'\)/, 'la proposition doit suivre le code reçu par SMS, pour un SUPERADMIN');
    });

    test('codes de secours : montrés une seule fois, « Imprimez-les ou notez-les en lieu sûr », nombre restant, remplacer annule', () => {
        const panel = read('components/admin/BackupCodesPanel.tsx');
        assert.ok(panel.includes('Imprimez-les ou notez-les en lieu sûr'), 'texte exact « Imprimez-les ou notez-les en lieu sûr » absent');
        assert.match(panel, /Ils ne s’afficheront plus jamais/);
        assert.match(panel, /Il vous reste/);
        assert.match(panel, /Remplacer vos codes annule les anciens/);
        assert.match(panel, /useIdentityConfirm\(/, 'créer des codes doit demander le mot de passe et le code administrateur');
        assert.match(panel, /reply\.codes\.length === 10/, 'les codes affichés doivent être ceux rendus par le serveur');
        assert.doesNotMatch(panel, /localStorage|sessionStorage/, 'les codes ne doivent jamais être gardés dans le navigateur');
    });

    test('changement de numéro : code au nouveau numéro, 6 chiffres, « Numéro changé » seulement sur la réponse du serveur', () => {
        const flow = read('components/admin/PhoneChangeFlow.tsx');
        for (const url of ['/api/admin/security/phone/start', '/api/admin/security/phone/confirm']) assert.ok(flow.includes(url), `${url} absente`);
        assert.match(flow, /\/api\/admin\/users\/\$\{target\.id\}\/phone\/start/);
        assert.match(flow, /<OtpInput\b/);
        assert.match(flow, /Envoyer le code au nouveau numéro/);
        assert.match(flow, /if \(reply\.ok === true\) \{\s*const n = Number\(reply\.sessions_revoked/, '« Numéro changé » sans la réponse du serveur');
        assert.match(flow, /Motif \(obligatoire\)/, 'motif obligatoire pour le numéro d’un ADMIN');
    });

    test('« Changer le numéro » : sur la ligne d’un ADMIN, pour le SUPERADMIN, jamais sur la sienne', () => {
        const page = read('app/admin/users/page.tsx');
        assert.match(page, /isSuperadmin && isAdmin && !isDeleted && user\.id !== me\?\.id && \(\s*<Button[\s\S]{0,120}?setPhoneTarget\(user\)/);
        assert.match(page, /<AdminPhoneChangeDialog\b/);
    });

    test('page « Sécurité du compte » : au menu du SUPERADMIN seulement ; un ADMIN y lit qu’elle lui est fermée', async () => {
        const superadmin = await navHrefs([], true);
        assert.ok(superadmin.menu.includes('/admin/securite'), 'menu du SUPERADMIN sans « Sécurité du compte »');
        assert.ok(superadmin.pro.includes('/admin/securite'));
        const admin = await navHrefs(['users.read', 'users.write', 'settings.read'], false);
        assert.ok(!admin.menu.includes('/admin/securite') && !admin.pro.includes('/admin/securite'), '« Sécurité du compte » au menu d’un ADMIN');
        const page = read('app/admin/securite/page.tsx');
        assert.match(page, /<BackupCodesPanel\b/);
        assert.match(page, /<PhoneChangeFlow target=\{\{ kind: 'SELF' \}\}/);
        assert.match(page, /Réservé au Superadmin/);
    });

    // Garde-fou (vert dès l'écriture, signalé au rapport) : le code envoyé au nouveau numéro est un envoi synchrone, hors de
    // la boucle du catalogue de textes-sms-9bis (liste fixe de 7 types) ; texte exact, GSM-7 de base, un segment.
    test('SMS du code au nouveau numéro (OTP_ADMIN_PHONE) : texte exact, GSM-7 de base, un seul segment', async () => {
        const mod = (await import('../../lib/notifications/catalog')) as { renderSyncSms: (type: string, d: Record<string, unknown>) => string };
        const text = mod.renderSyncSms('OTP_ADMIN_PHONE', { code: '483920' });
        assert.equal(text, 'Event Village : code 483920 pour confirmer ce numéro sur un compte administrateur. Donnez-le seulement au Superadmin. Valable 10 minutes.');
        const gsm7 = new Set(Array.from('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'));
        const outside = Array.from(text).filter((c) => !gsm7.has(c));
        assert.deepEqual(outside, [], `caractères hors GSM-7 de base : ${outside.join(' ')}`);
        assert.ok(Array.from(text).length <= 160, `${Array.from(text).length} septets : plus d'un segment`);
    });
});

// ── 3. Changer le rôle : écrans ───────────────────────────────────────────────────────────────────────────────────

describe('3. changer le rôle : écrans', () => {
    test('« Changer le rôle » sur la ligne d’un compte, pour le SUPERADMIN ; « Quitter le rôle de Superadmin » sur la sienne', () => {
        const page = read('app/admin/users/page.tsx');
        assert.match(page, /isSuperadmin && !isDeleted && !isPartner/);
        assert.match(page, /Quitter le rôle de Superadmin/);
        assert.match(page, /Pour nommer un Superadmin : créez un administrateur, puis « Changer le rôle » sur sa ligne\./);
    });

    test('« fait » seulement si le serveur rend le rôle demandé ; motif ; confirmation de la finition 1', () => {
        const dlg = read('components/admin/RoleChangeDialog.tsx');
        assert.match(dlg, /reply\.ok === true && reply\.role_after === to/);
        assert.match(dlg, /STAFF_PROMOTION_CONFIRMATION/);
        assert.match(dlg, /Motif \(obligatoire\)/);
        assert.match(dlg, /useIdentityConfirm\(/);
    });
});

// ── Contre-vérification, T1 : le numéro d'un compte d'administration ne se change pas par le profil client ──────────

describe('contre-vérification T1 : profil d’un compte d’administration', () => {
    test('chemin du changement de numéro selon le rôle : ADMIN par le Superadmin, SUPERADMIN par « Sécurité du compte », client ici', async () => {
        const mod = (await import('../../lib/admin/phone-path')) as { adminPhonePath: (roles: string[]) => { code: string; message: string } | null };
        assert.deepEqual(mod.adminPhonePath(['CLIENT', 'ADMIN']), { code: 'PHONE_CHANGE_BY_SUPERADMIN', message: 'Demandez au super-administrateur de changer votre numéro.' });
        assert.equal(mod.adminPhonePath(['CLIENT', 'SUPERADMIN'])?.code, 'PHONE_CHANGE_SECURITY_PAGE');
        assert.match(mod.adminPhonePath(['SUPERADMIN'])?.message ?? '', /« Sécurité du compte »/);
        for (const roles of [['CLIENT'], ['CLIENT', 'PARTENAIRE'], ['CLIENT', 'CONTROLEUR'], []]) assert.equal(mod.adminPhonePath(roles), null, roles.join(','));
    });

    test('écran du profil : plus de « Changer de numéro » pour un ADMIN ou un SUPERADMIN, le message du bon chemin à la place', () => {
        const form = read('components/profile/ProfileForm.tsx');
        assert.match(form, /const adminPath = adminPhonePath\(profile\.roles/);
        assert.match(form, /\{!adminPath \? \(\s*<Button[^]*?Changer de numéro/, '« Changer de numéro » doit dépendre du rôle');
        assert.match(form, /\{!adminPath && <PhoneChangeDialog\b/, 'la fenêtre du changement ne doit pas exister pour un admin');
        assert.match(form, /SECURITY_PAGE_HREF/, 'le Superadmin doit être mené à « Sécurité du compte »');
        for (const route of ['app/api/account/phone/start/route.ts', 'app/api/account/phone/confirm/route.ts']) {
            assert.match(read(route), /const adminPath = adminPhonePath\(user\.roles\);\s*if \(adminPath\) return/, `${route} : garde du rôle absente`);
        }
    });
});

// ── Contre-vérification, T4 : créer un ADMIN et régler ses droits demandent mot de passe et code ───────────────────

describe('contre-vérification T4 : création d’un administrateur et grille des droits', () => {
    test('écran des comptes : création et enregistrement des droits passent par la fenêtre « mot de passe et code »', () => {
        const page = read('app/admin/users/page.tsx');
        assert.match(page, /useIdentityConfirm\(\)/);
        assert.match(page, /runWithIdentity\(\(\) => sendJson<[^>]*>\('\/api\/admin\/users', 'POST'/, 'création sans la fenêtre d’identité');
        assert.match(page, /runWithIdentity\(\(\) => sendJson\('\/api\/admin\/permissions', 'POST'/, 'droits enregistrés sans la fenêtre d’identité');
        assert.match(page, /\{identityDialog\}/);
    });

    test('routes : requireAdminIdentity pour créer un ADMIN et pour la grille des droits ; rôle ADMIN par admin_account_admin_role', () => {
        const users = read('app/api/admin/users/route.ts');
        assert.match(users, /if \(targetRole === 'ADMIN'\) \{\s*const checked = await requireAdminIdentity\(req, auth\.user!\.id\);/);
        assert.match(users, /rpc\('admin_account_admin_role'/);
        const perms = read('app/api/admin/permissions/route.ts');
        assert.match(perms, /const identity = await requireAdminIdentity\(req, auth\.user!\.id\);\s*if \(!identity\.ok\) return identity\.response;/);
    });
});

// ── Contre-vérification, T5 : routes de compte par requireActiveSession (code administrateur d'un admin) ───────────

describe('contre-vérification T5 : routes de compte qui servaient un admin sans le code', () => {
    test('GET /api/referrals/my-stats et DELETE /api/push/subscriptions passent par requireActiveSession', () => {
        const stats = read('app/api/referrals/my-stats/route.ts');
        assert.match(stats, /export async function GET[\s\S]*?const session = await requireActiveSession\(req[^)]*\);\s*if \(session\.response\) return session\.response;/);
        assert.doesNotMatch(stats, /getAuthenticatedUser\(/, 'plus aucune lecture de session sans le contrôle de l’administration');
        const push = read('app/api/push/subscriptions/route.ts');
        assert.match(push, /export async function DELETE[\s\S]*?const session = await requireActiveSession\(req[^)]*\);\s*if \(session\.response\) return session\.response;/);
        assert.doesNotMatch(push, /getServerSessionUser\(/, 'plus aucune lecture de session sans le contrôle de l’administration');
    });
});
