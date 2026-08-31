import { test } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';

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
    assert.ok(
        dashboardContent.includes('handleViewDocument(selectedPartner.id_card_url'),
        'Un bouton d\'ouverture doit être disponible pour la pièce d\'identité'
    );
    assert.ok(
        dashboardContent.includes('handleViewDocument(selectedPartner.business_doc_url'),
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

test('4. TRIGGER MÉTIER SUPERADMIN : Notification in-app lors de la candidature partenaire', () => {
    const notifServicePath = path.resolve(process.cwd(), 'lib/notifications/notification.service.ts');
    const notifServiceContent = fs.readFileSync(notifServicePath, 'utf8');

    // Vérifier notifySuperadmins
    assert.ok(
        notifServiceContent.includes('static async notifySuperadmins'),
        'NotificationService doit contenir une méthode notifySuperadmins'
    );
    assert.ok(
        notifServiceContent.includes('NotificationService.notifySuperadmins'),
        'sendPartnerRegistrationNotification doit déclencher notifySuperadmins'
    );
    assert.ok(
        notifServiceContent.includes("type: 'KYC'"),
        'Les notifications de candidature doivent avoir le type KYC'
    );
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
