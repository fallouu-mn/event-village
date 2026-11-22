/**
 * Finition 5 (point 2) — chaque type d'avis du catalogue mène à l'objet exact (sans base).
 *
 * Revue de TOUS les types de lib/notifications/catalog.ts qui portent un lien (cloche, push, email) : lien calculé sur
 * l'exemple du type (`sample`). Règle : si l'exemple porte un identifiant d'objet (clé « …_id », uuid), le lien contient
 * l'un d'eux ; sinon le type figure dans SANS_OBJET avec la raison (objet retiré, compte lui-même, file de travail…), et
 * cette liste ne peut pas vieillir (une exception dont le lien contient désormais l'objet est refusée).
 * Plus : pages d'arrivée présentes (billet, billets d'un événement, retrait pro et portefeuille), même page « Cet élément
 * n'est plus disponible » pour un objet absent, un lien ne fait jamais échouer un envoi (données anciennes sans identifiant),
 * le retour après connexion garde ?tab= et les paramètres.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';
import { internalActionUrl } from '../../lib/notifications/action-url';
import { isObjectId, ticketsInFocus, UNAVAILABLE_BODY } from '../../lib/tickets/focus';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Entry = { link: ((d: object) => string) | null; sample: Record<string, unknown>; channels: readonly string[] };
const ENTRIES = Object.entries(NOTIFICATION_CATALOG as unknown as Record<string, Entry>);

/** Types dont le lien ne porte pas d'identifiant alors que l'avis en a un : raison de chacun (tableau du rapport, § 4). */
const SANS_OBJET: Record<string, string> = {
    TRANSFER_CANCELLED: 'transfert retiré par l’expéditeur : plus rien à ouvrir, onglet « Reçus »',
    TRANSFER_REVOKED: 'transfert retiré : plus rien à ouvrir, onglet « Reçus »',
    TRANSFER_CLAIMED_SENDER: 'le billet a quitté le compte de l’expéditeur : billets restants',
    PARTNER_REGISTERED_ACK: 'l’objet est le compte partenaire lui-même : son tableau de bord',
    PARTNER_VALIDATED: 'l’objet est le compte partenaire lui-même : son tableau de bord',
    PARTNER_REJECTED: 'l’objet est le compte partenaire lui-même : son tableau de bord (dossier à compléter)',
    PARTNER_SUSPENDED: 'l’objet est le compte partenaire lui-même : son tableau de bord',
    PARTNER_REACTIVATED: 'l’objet est le compte partenaire lui-même : son tableau de bord',
    TRIAL_STARTED: 'l’objet est le compte partenaire lui-même : son tableau de bord',
    SUBSCRIPTION_ACTIVATED: 'l’objet est l’abonnement du compte : sa page',
    PAYMENT_SUCCESS: 'paiement d’une commande : pages de commande du lot 12b (service fermé), liste des commandes',
    CONTROLLER_ASSIGNED: 'le scanner ouvre lui-même l’événement du poste affecté',
    CONTROLLER_UNASSIGNED: 'affectation retirée : le scanner montre les postes restants',
    CONTROLLER_REMINDER: 'le scanner ouvre lui-même l’événement du poste affecté',
    SHIFT_CLOSED_BY_OTHER: 'caisse fermée : le scanner montre l’état du poste',
    CONTROLLER_EVENT_CANCELLED: 'événement annulé : le scanner montre les postes restants',
    CONTROLLER_EVENT_CHANGED: 'le scanner ouvre lui-même l’événement du poste affecté',
    CONTROLLER_EVENT_STATUS: 'le scanner ouvre lui-même l’événement du poste affecté',
    ORDER_COURIER_CANCELLED: 'course retirée au livreur : plus rien à ouvrir (pages du lot 12b)',
    ADMIN_PERMISSIONS_CHANGED: 'l’objet est la page « Mes droits » de l’administrateur',
    ADMIN_PERMISSIONS_ALERT: 'liste des administrateurs (aucune fiche par compte ; après-lancement)',
    ADMIN_REFUND_TO_RETRY: 'file « Versements à reprendre » des finances (aucune fiche par versement ; après-lancement)',
    ADMIN_DUPLICATE_PAYMENT: 'file « Remboursements à verser » (aucune fiche par paiement ; après-lancement)',
    ADMIN_CASHOUT_UNCERTAIN: 'file « Versements à reprendre » (aucune fiche par versement ; après-lancement)',
    ADMIN_WITHDRAWAL_REJECTED: 'file « Dû aux partenaires » (aucune fiche par retrait ; après-lancement)',
    ADMIN_FINANCE_DEBT: 'file « Créances » (aucune fiche par créance ; après-lancement)',
    ADMIN_CASHOUT_TO_RESUME: 'file « Versements à reprendre » (aucune fiche par versement ; après-lancement)',
    CONTROLLER_INVITATION_ACCEPTED: 'équipe de la partenaire (aucune ancre par invitation ; après-lancement)',
    CONTROLLER_INVITATION_DECLINED: 'équipe de la partenaire (aucune ancre par invitation ; après-lancement)',
    CONTROLLER_INVITATION_EXPIRED: 'équipe de la partenaire (aucune ancre par invitation ; après-lancement)',
    FUNDS_AVAILABLE: 'l’objet est le solde du compte : les finances',
};

function sampleIds(sample: Record<string, unknown>): Array<[string, string]> {
    return Object.entries(sample).filter((e): e is [string, string] => e[0].endsWith('_id') && typeof e[1] === 'string' && UUID.test(e[1]));
}

describe('finition 5 — liens précis des avis : revue de TOUT le catalogue', () => {
    test('chaque type à lien : chemin interne, et l’objet exact dès que l’avis en porte un (sinon raison écrite)', () => {
        const issues: string[] = [];
        let reviewed = 0;
        for (const [type, e] of ENTRIES) {
            if (!e.link) continue;
            reviewed += 1;
            const link = e.link(e.sample);
            if (internalActionUrl(link) !== link) issues.push(`${type} : lien non interne ${JSON.stringify(link)}`);
            const ids = sampleIds(e.sample);
            const exact = ids.some(([, v]) => link.includes(v));
            if (ids.length > 0 && !exact && !SANS_OBJET[type]) issues.push(`${type} : mène à ${link} alors que l’avis porte ${ids.map(([k]) => k).join(', ')}`);
            if (SANS_OBJET[type] && exact) issues.push(`${type} : exception périmée (le lien ${link} contient déjà l’objet)`);
        }
        for (const type of Object.keys(SANS_OBJET)) if (!ENTRIES.some(([t, e]) => t === type && e.link)) issues.push(`${type} : exception d’un type absent ou sans lien`);
        console.log(`[F5-LIENS] ${reviewed} types à lien passés en revue, ${Object.keys(SANS_OBJET).length} sans objet propre (raison écrite)`);
        assert.ok(reviewed >= 150, `${reviewed} types à lien seulement : catalogue mal lu ?`);
        assert.deepEqual(issues, [], issues.join('\n'));
    });

    test('billet, billets d’un événement, retrait : chemins des pages d’arrivée', () => {
        const link = (t: string, over: Record<string, unknown> = {}) => {
            const e = (NOTIFICATION_CATALOG as unknown as Record<string, Entry>)[t];
            return e.link!({ ...e.sample, ...over });
        };
        const T = '5c2a8e41-9b3d-4f7a-8e16-2d4b6a9c1e73';
        const E = '7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01';
        const C = '3a7d9e2b-6c1f-4b8a-9d5e-1f3b7c9a2e64';
        assert.equal(link('TRANSFER_RECEIVED', { ticket_id: T }), `/tickets/${T}`);
        assert.equal(link('PURCHASE_CONFIRMED', { event_id: E }), `/tickets/${E}`);
        assert.equal(link('REMINDER_J1', { event_id: E }), `/tickets/${E}`);
        assert.equal(link('TICKET_SCANNED', { ticket_id: T, ticket_count: 3, event_id: E }), `/tickets/${E}`, 'plusieurs billets contrôlés : ceux de l’événement');
        assert.equal(link('TICKET_SCANNED', { ticket_id: T, ticket_count: 1 }), `/tickets/${T}`);
        assert.equal(link('WITHDRAWAL_PAID', { cashout_id: C, account_kind: 'ORGANISATEUR' }), `/partner/finance/retraits/${C}`);
        assert.equal(link('WITHDRAWAL_PAID', { cashout_id: C, account_kind: 'PARRAINAGE' }), `/wallet/retraits/${C}`);
        assert.equal(link('EVENT_CANCELLED', { refund_mode: 'TRANSFERRED' }), '/tickets?tab=historique', 'acheteur d’origine d’un billet transféré : il n’a plus le billet');
    });

    test('données anciennes sans identifiant : le lien se replie, l’envoi n’échoue jamais', () => {
        const e = (t: string) => (NOTIFICATION_CATALOG as unknown as Record<string, Entry>)[t];
        const without = (t: string, keys: string[]) => Object.fromEntries(Object.entries(e(t).sample).filter(([k]) => !keys.includes(k)));
        assert.equal(e('TICKET_CANCELLED').link!(without('TICKET_CANCELLED', ['ticket_id'])), `/tickets/${e('TICKET_CANCELLED').sample.event_id}`);
        assert.equal(e('REFUND_PAID').link!(without('REFUND_PAID', ['event_id'])), '/tickets?tab=historique');
        assert.equal(e('WITHDRAWAL_PAID').link!(without('WITHDRAWAL_PAID', ['cashout_id'])), '/partner/finance');
        assert.equal(e('TICKET_SCANNED').link!(without('TICKET_SCANNED', ['ticket_id'])), `/tickets/${e('TICKET_SCANNED').sample.event_id}`);
    });

    test('sélection des billets d’une page d’arrivée : billets du compte seulement, même réponse pour un identifiant deviné ou mal formé', () => {
        const mine = [{ id: 'aaaaaaaa-1111-4111-8111-111111111111', eventId: 'eeeeeeee-1111-4111-8111-111111111111' },
            { id: 'aaaaaaaa-2222-4222-8222-222222222222', eventId: 'eeeeeeee-1111-4111-8111-111111111111' }];
        assert.deepEqual(ticketsInFocus(mine, { ticket: 'AAAAAAAA-1111-4111-8111-111111111111' }), [mine[0]]);
        assert.deepEqual(ticketsInFocus(mine, { event: 'eeeeeeee-1111-4111-8111-111111111111' }), mine);
        for (const guess of ['bbbbbbbb-1111-4111-8111-111111111111', '../admin', 'x', '', 'eeeeeeee-1111-4111-8111-111111111111']) {
            assert.equal(ticketsInFocus(mine, { ticket: guess }), null, `billet ${JSON.stringify(guess)}`);
        }
        assert.equal(ticketsInFocus(mine, { event: 'aaaaaaaa-1111-4111-8111-111111111111' }), null, 'un billet n’est pas un événement');
        assert.equal(isObjectId("1' or '1'='1"), false);
        assert.deepEqual({ ...UNAVAILABLE_BODY }, { error: 'Cet élément n’est plus disponible.', code: 'NOT_AVAILABLE' });
    });

    test('pages d’arrivée : session et propriété exigées, même page « Cet élément n’est plus disponible » sans indice', () => {
        // Une route pour le billet et les billets d'un événement ; page « plus disponible » rendue par la page (pas de fichier
        // not-found) : la même réponse dans tous les cas
        for (const page of ['app/tickets/[id]/page.tsx', 'app/partner/finance/retraits/[id]/page.tsx', 'app/wallet/retraits/[id]/page.tsx']) {
            assert.ok(fs.existsSync(path.join(ROOT, page)), `${page} présente`);
            assert.ok(!fs.existsSync(path.join(ROOT, page.replace('page.tsx', 'not-found.tsx'))), `${page} : aucun not-found séparé`);
        }
        assert.ok(!fs.existsSync(path.join(ROOT, 'app/tickets/evenement')), 'aucune route séparée pour les billets d’un événement');
        assert.match(read('app/tickets/[id]/page.tsx'), /if \(read\.kind === 'not-found'\) return <UnavailableItem actionLabel="Voir mes billets" actionHref="\/tickets" \/>;/);
        assert.match(read('components/ui/UnavailableItem.tsx'), /<h1 [^>]*>Cet élément n’est plus disponible<\/h1>/, 'titre de la page (niveau 1)');
        const focus = read('app/tickets/focus-read.ts');
        assert.match(focus, /if \(res\.status === 401\) return \{ kind: 'login' \};/);
        assert.match(focus, /const ticket = ticketsInFocus\(list, \{ ticket: id \}\);/, 'le billet du compte d’abord');
        assert.match(focus, /return ofEvent \? \{ kind: 'ok', focus: 'event', tickets: ofEvent \} : \{ kind: 'not-found' \};/, 'puis les billets du compte pour l’événement, sinon introuvable');
        for (const route of ['app/api/tickets/[id]/route.ts', 'app/api/finance/withdrawals/[id]/route.ts']) {
            const src = read(route);
            assert.match(src, /NextResponse\.json\(UNAVAILABLE_BODY, \{ status: 404/, `${route} : réponse 404 unique`);
            assert.doesNotMatch(src, /status: 403/, `${route} : jamais de 403 qui dirait que l’objet existe`);
        }
        assert.match(read('lib/finance/ledger.ts'), /\.eq\('user_id', ownerId\)\n\s*\.eq\('cashout_id', cashoutId\)/, 'retrait lu pour le seul compte de la session');
        const detail = read('components/finance/WithdrawalDetail.tsx');
        assert.match(detail, /if \(r\.kind === 'not-found'\) return unavailable;/);
        assert.match(detail, /if \(\(w\.account_kind === 'PARRAINAGE'\) !== \(space === 'portefeuille'\)\) return unavailable;/, 'autre espace : même page');
    });

    test('retour après connexion : l’adresse complète (?tab=, ?rappel=1) revient, relue par safeInternalPath', () => {
        const mw = read('middleware.ts');
        assert.match(mw, /loginUrl\.searchParams\.set\('redirect', `\$\{pathname\}\$\{req\.nextUrl\.search\}`\);/);
        assert.match(read('app/login/page.tsx'), /safeInternalPath\(firstParam\(searchParams\?\.redirect\)\)/);
    });

    test('ancres des objets dans une liste : transfert reçu (recu-<id>) et invitation de contrôleur (invitation-<id>) existent', () => {
        assert.match(read('components/tickets/IncomingTransfers.tsx'), /id=\{`recu-\$\{t\.transfer_id\}`\}/);
        assert.match(read('app/invitations/page.tsx'), /id=\{`invitation-\$\{inv\.id\}`\}/);
    });
});
