// [lot 0] Garde-fou anti-base réelle + environnement de test (.env.test, instance locale)
import './helpers/env';
import { test } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { inspect } from './helpers/db';
import { NOTIFICATION_CATALOG } from '../lib/notifications/catalog';

test('1. SÉCURITÉ KYC & VISUALISATION DOCUMENTS : Présence des boutons d\'action et URLs signées', () => {
    const dashboardPath = path.resolve(process.cwd(), 'app/admin/dashboard/page.tsx');
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

    // Vérifier l'appel à /api/partner/documents/signed-url
    assert.ok(
        dashboardContent.includes('/api/partner/documents/signed-url'),
        'Le dashboard doit appeler /api/partner/documents/signed-url pour la génération d\'URLs signées'
    );

    // Vérifier l'ouverture sécurisée en nouvel onglet
    assert.ok(
        dashboardContent.includes("window.open(data.signedUrl, '_blank', 'noopener,noreferrer')"),
        'Les documents doivent s\'ouvrir de façon sécurisée dans un nouvel onglet avec noopener,noreferrer'
    );

    // Vérifier les boutons d'action au lieu de simples badges
    // Lot 1C.2 : l'URL signée se demande par dossier et type de pièce, plus par chemin.
    assert.ok(
        dashboardContent.includes("handleViewDocument(selectedPartner.id, 'id_card'"),
        'Un bouton d\'ouverture doit être disponible pour la pièce d\'identité'
    );
    assert.ok(
        dashboardContent.includes("handleViewDocument(selectedPartner.id, 'business_doc'"),
        'Un bouton d\'ouverture doit être disponible pour le document NINEA/RCCM'
    );
});

test('2. MOTEUR UNIVERSEL DE NOTIFICATIONS : Éradication totale des mocks frontend', () => {
    const notifPagePath = path.resolve(process.cwd(), 'app/notifications/page.tsx');
    const notifPageContent = fs.readFileSync(notifPagePath, 'utf8');

    // Zéro mock codé en dur
    assert.ok(
        !notifPageContent.includes('notif-01') && !notifPageContent.includes('EV-8849-2026-XOF'),
        'Aucun mock codé en dur ne doit subsister dans app/notifications/page.tsx'
    );

    // Connexion aux routes réelles
    assert.ok(
        notifPageContent.includes("fetch('/api/notifications"),
        'La page notifications doit faire des requêtes vers /api/notifications'
    );
    assert.ok(
        notifPageContent.includes("fetch(`/api/notifications/${id}/read`"),
        'La page notifications doit appeler /api/notifications/[id]/read'
    );
});

test('3. NOTIFICATION BELL NAVBAR : Composant interactif connecté avec badge dynamique', () => {
    const bellPath = path.resolve(process.cwd(), 'components/notifications/NotificationBell.tsx');
    assert.ok(fs.existsSync(bellPath), 'Le composant NotificationBell.tsx doit exister');

    const bellContent = fs.readFileSync(bellPath, 'utf8');

    // Vérifier le fetching et la gestion des non-lues
    assert.ok(
        bellContent.includes("fetch('/api/notifications?limit=20')"),
        'NotificationBell doit interroger /api/notifications'
    );
    assert.ok(
        bellContent.includes('unreadCount'),
        'NotificationBell doit calculer et afficher le compteur de non-lues'
    );
    assert.ok(
        bellContent.includes('handleMarkAllAsRead'),
        'NotificationBell doit permettre de tout marquer comme lu'
    );

    // Vérifier l'intégration dans AppLayout ou AppLayoutHeader
    const appLayoutPath = path.resolve(process.cwd(), 'components/layout/AppLayout.tsx');
    const headerPath = path.resolve(process.cwd(), 'components/layout/AppLayoutHeader.tsx');
    const layoutContent = fs.existsSync(headerPath)
        ? fs.readFileSync(headerPath, 'utf8')
        : fs.readFileSync(appLayoutPath, 'utf8');
    assert.ok(
        layoutContent.includes('<NotificationBell />'),
        'AppLayout ou AppLayoutHeader doit intégrer le composant <NotificationBell />'
    );
});

// Lot 6 (contrat T, fix(6.7)) : NotificationService est supprimé (contrat K). La même règle métier
// (candidature partenaire → notification in-app de type KYC aux administrateurs) est vérifiée par le
// registre notification_types, le catalogue des modèles et le trigger trg_partners_notify.
test('4. TRIGGER MÉTIER SUPERADMIN : Notification in-app lors de la candidature partenaire', async () => {
    const tpl = NOTIFICATION_CATALOG.ADMIN_PARTNER_REGISTERED;
    assert.equal(tpl.inAppType, 'KYC', 'Les notifications de candidature doivent avoir le type KYC');
    assert.equal(tpl.audience, 'ADMIN', 'La candidature partenaire est notifiée aux administrateurs');
    assert.ok(tpl.channels.includes('IN_APP'), 'La candidature partenaire a un canal in-app (catalogue)');

    const out = await inspect(async (db) => {
        const reg = await db.query<{ audience: string; channels: string[] }>(
            `SELECT audience, channels FROM public.notification_types WHERE type = 'ADMIN_PARTNER_REGISTERED'`);
        const trg = await db.query<{ tgtype: number; def: string }>(
            `SELECT t.tgtype, pg_get_functiondef(t.tgfoid) AS def
               FROM pg_trigger t
               JOIN pg_class c ON c.oid = t.tgrelid
               JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND c.relname = 'partners'
                AND t.tgname = 'trg_partners_notify' AND NOT t.tgisinternal`);
        return { reg: reg.rows, trg: trg.rows };
    });
    assert.equal(out.reg.length, 1, 'ADMIN_PARTNER_REGISTERED doit figurer au registre notification_types');
    assert.equal(out.reg[0].audience, 'ADMIN', 'registre : audience ADMIN');
    assert.ok(out.reg[0].channels.includes('IN_APP'), 'registre : canal IN_APP');
    assert.equal(out.trg.length, 1, 'Le trigger trg_partners_notify doit exister sur public.partners');
    // tgtype : bit 2 = INSERT (candidature).
    assert.ok((out.trg[0].tgtype & 4) !== 0, 'trg_partners_notify doit se déclencher à l\'insertion d\'un partenaire');
    assert.match(out.trg[0].def, /'ADMIN_PARTNER_REGISTERED'/, 'La fonction du trigger doit créer ADMIN_PARTNER_REGISTERED');
});

test('5. ROUTES API NOTIFICATIONS : Présence et conformité des endpoints', () => {
    const getNotifsPath = path.resolve(process.cwd(), 'app/api/notifications/route.ts');
    const readSinglePath = path.resolve(process.cwd(), 'app/api/notifications/[id]/read/route.ts');

    assert.ok(fs.existsSync(getNotifsPath), 'GET /api/notifications doit exister');
    assert.ok(fs.existsSync(readSinglePath), 'PATCH /api/notifications/[id]/read doit exister');

    const getNotifsContent = fs.readFileSync(getNotifsPath, 'utf8');
    assert.ok(
        getNotifsContent.includes("status: 'READ'") || getNotifsContent.includes('unreadCount'),
        'GET /api/notifications doit gérer le statut READ et le unreadCount'
    );
});
