/**
 * Lot 5, tâche 5.10 — page de pilotage, onglets Aperçu et Ventes (contrat, sections I et U).
 * Exigence de la consigne : « les chiffres de la page = la vérité en base sur un jeu de données connu ».
 *  - GET /api/partner/events/[id]/pilotage/overview (RPC pilotage_overview) : statut et actions
 *    possibles (event_actions, D5) ; vendus = billets VALIDE et UTILISE hors invitations ; invitations à
 *    part ; capacité = Σ quotas des catégories ACTIVES ; en cours de paiement = réservations ACTIVE ;
 *    restants ; CA en ligne (grand livre VENTE − REMBOURSEMENT), CA espèces (paiements hors plateforme
 *    SUCCESS, le billet « à régler sur place » impayé exclu), remboursé ; entrées (scans acceptés) dont
 *    guichet ; taux de présence = entrées / (vendus + invitations) ;
 *  - l'admin lit les mêmes chiffres ; l'action « suspendre » (motif obligatoire) lui est proposée, pas au
 *    partenaire ;
 *  - GET …/pilotage/sales (RPC pilotage_sales) : par catégorie (vendus, en cours de paiement, restants),
 *    jour par jour en Africa/Dakar ; Σ par catégorie = aperçu (une seule source).
 * Jeu de données et valeurs attendues (calculées à la main) : tests/parcours/pilotage-helpers.ts
 * (buildKnownDataset, EXPECTED). Les jours attendus sont déduits des horodatages bruts des billets du jeu.
 * Champs de réponse fixés par ces suites : en-tête de pilotage-helpers.ts.
 *
 * Rouge avant correctif :
 *  - aucune route app/api/partner/events/[id]/pilotage/* : le dossier app/api/partner/events/[id]/ ne
 *    contient que cancel, cancellation, categories, promotion, regisseur-pin, shifts, status et tickets ;
 *    aucune RPC pilotage_* ni pilotage_compute_* (aucune migration ne les définit) ;
 *  - le jeu de données échoue avant : RPC event_transition absente (cycle-helpers, contrat D4), colonne
 *    tickets.sale_channel absente (contrat C7), table scan_incidents absente (C8), vente au guichet sans
 *    compostage ni ligne ticket_scans (supabase/migrations/20261101000011_lot4_caisse.sql:185-274), clôture
 *    de caisse sans clé `justification` (app/api/controller/shifts/close/route.ts:13-14) ;
 *  - définitions actuelles divergentes, calculées en TypeScript : capacité `events.capacity || 1`
 *    (lib/partner/partner-dashboard.service.ts:459) ou `events.capacity || Σ quotas` (:643), restants =
 *    capacité − vendus sans les paniers en cours (:471, :686), « espèces » comptant les billets payants
 *    sans paiement (supabase/migrations/20261101000008_lot3_rapports.sql:53-59).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import { newAdminWith } from './terrain-helpers'; import type { TestAdmin } from './notif-helpers';
import {
    buildKnownDataset, dakarDay, eventTicketRows, EXPECTED, ETUDIANT, findItem, listAt, numberAt, pilotageGet, pilotageOk, PREVENTE, show, STANDARD, VIP,
    type KnownDataset,
} from './pilotage-helpers';

let ds: KnownDataset;
let admin: TestAdmin; let adminBare: TestAdmin; // lot 9 bis (R2, T29) : admin events.read + events.write (actions de l'admin), admin sans permission

before(async () => {
    ds = await buildKnownDataset('apercu');
    admin = await newAdminWith(['events.read', 'events.write'], { label: 'apercu-admin' }); adminBare = await newAdminWith([], { label: 'apercu-nu' });
});

after(async () => {
    await assertLifecycleInvariants('pilotage-apercu-ventes');
});

const ADMIN_ONLY_TARGETS = ['SUSPENDU', 'TERMINE', 'VALIDE'];

function assertHumanActions(actions: Array<Record<string, unknown>>, who: string): void {
    for (const a of actions) {
        assert.equal(typeof a.to, 'string', `${who} : action sans cible ${JSON.stringify(a)}`);
        assert.equal(typeof a.label, 'string', `${who} : action sans libellé ${JSON.stringify(a)}`);
        assert.ok(String(a.label).trim().length > 0, `${who} : libellé vide ${JSON.stringify(a)}`);
        assert.notEqual(a.label, a.to, `${who} : libellé humain attendu, pas l’enum brut ${JSON.stringify(a)}`);
    }
}

describe('5.10 Aperçu : GET …/pilotage/overview', () => {
    test('propriétaire : statut PUBLIE et actions possibles du partenaire, sans aucune action réservée à l’admin', async () => {
        const body = await pilotageOk(ds.partner, ds.eventId, 'overview', 'le partenaire propriétaire');
        assert.equal(body.status, 'PUBLIE', `statut de l’événement : ${JSON.stringify(body).slice(0, 400)}`);
        const actions = listAt(body, 'actions', 'actions possibles du partenaire');
        assertHumanActions(actions, 'partenaire');
        const targets = actions.map((a) => a.to);
        for (const t of [...ADMIN_ONLY_TARGETS, 'EN_ATTENTE', 'BROUILLON']) {
            assert.ok(!targets.includes(t), `partenaire sur un événement PUBLIE : action ${t} non proposée (table de transitions D1) : ${JSON.stringify(actions)}`);
        }
    });

    test('billets : vendus hors invitations, invitations à part, capacité = Σ quotas actifs, en cours de paiement, restants', async () => {
        const body = await pilotageOk(ds.partner, ds.eventId, 'overview', 'le partenaire propriétaire');
        const t = EXPECTED.tickets;
        assert.equal(numberAt(body, 'tickets.sold', 'vendus'), t.sold,
            'vendus = billets VALIDE et UTILISE de tous les canaux (en ligne, à régler sur place, guichet), hors invitation et hors billet remboursé');
        assert.equal(numberAt(body, 'tickets.invitations', 'invitations'), t.invitations, 'invitations comptées à part');
        assert.equal(numberAt(body, 'tickets.capacity', 'capacité'), t.capacity,
            'capacité = Σ quotas des catégories actives (50 + 10 + 20), ni la jauge déclarée events.capacity (120), ni la catégorie inactive');
        assert.equal(numberAt(body, 'tickets.in_payment', 'en cours de paiement'), t.in_payment, 'en cours de paiement = réservations ACTIVE non échues (panier de 3)');
        assert.equal(numberAt(body, 'tickets.remaining', 'restants'), t.remaining,
            'restants = capacité − vendus − invitations − en cours de paiement = stock vendable en base (total − sold_quantity − held_quantity)');
    });

    test('chiffre d’affaires : en ligne (grand livre), espèces (paiements hors plateforme, billet impayé exclu), remboursé', async () => {
        const body = await pilotageOk(ds.partner, ds.eventId, 'overview', 'le partenaire propriétaire');
        assert.equal(numberAt(body, 'revenue.online', 'CA en ligne'), EXPECTED.revenue.online,
            'CA en ligne = prix faciaux des billets payés en ligne non remboursés (VENTE 34 000 − REMBOURSEMENT 5 000)');
        assert.equal(numberAt(body, 'revenue.cash', 'CA espèces'), EXPECTED.revenue.cash,
            'CA espèces = paiements hors plateforme SUCCESS (5 000 au scan + 2 000 et 10 000 au guichet) ; le billet à régler sur place impayé n’y est pas');
        assert.equal(numberAt(body, 'revenue.refunded', 'remboursé'), EXPECTED.revenue.refunded, 'remboursé = 5 000 en ligne + 0 à rembourser par l’organisateur');
    });

    test('entrées : scans acceptés dont guichet, taux de présence = entrées / (vendus + invitations)', async () => {
        const body = await pilotageOk(ds.partner, ds.eventId, 'overview', 'le partenaire propriétaire');
        assert.equal(numberAt(body, 'entries.total', 'entrées'), EXPECTED.entries.total, 'entrées = scans acceptés (= billets UTILISE), guichet compris');
        assert.equal(numberAt(body, 'entries.counter', 'entrées au guichet'), EXPECTED.entries.counter, 'dont 3 ventes au guichet compostées (méthode COUNTER)');
        const rate = numberAt(body, 'entries.attendance_rate', 'taux de présence');
        assert.ok(Math.abs(rate - EXPECTED.entries.attendance_rate) < 0.001,
            `taux de présence = 7 / (10 + 1) ≈ ${EXPECTED.entries.attendance_rate.toFixed(4)} (rapport de 0 à 1), reçu ${rate}`);
    });

    test('admin events.read + events.write : 200 et mêmes chiffres ; l’action « suspendre » lui est proposée avec motif obligatoire', async () => {
        const body = await pilotageOk(admin, ds.eventId, 'overview', 'l’admin');
        assert.equal(body.status, 'PUBLIE');
        assert.equal(numberAt(body, 'tickets.sold', 'vendus (admin)'), EXPECTED.tickets.sold);
        assert.equal(numberAt(body, 'tickets.invitations', 'invitations (admin)'), EXPECTED.tickets.invitations);
        assert.equal(numberAt(body, 'tickets.capacity', 'capacité (admin)'), EXPECTED.tickets.capacity);
        assert.equal(numberAt(body, 'tickets.in_payment', 'en cours (admin)'), EXPECTED.tickets.in_payment);
        assert.equal(numberAt(body, 'tickets.remaining', 'restants (admin)'), EXPECTED.tickets.remaining);
        assert.equal(numberAt(body, 'revenue.online', 'CA en ligne (admin)'), EXPECTED.revenue.online);
        assert.equal(numberAt(body, 'revenue.cash', 'CA espèces (admin)'), EXPECTED.revenue.cash);
        assert.equal(numberAt(body, 'revenue.refunded', 'remboursé (admin)'), EXPECTED.revenue.refunded);
        assert.equal(numberAt(body, 'entries.total', 'entrées (admin)'), EXPECTED.entries.total);
        assert.equal(numberAt(body, 'entries.counter', 'entrées au guichet (admin)'), EXPECTED.entries.counter);
        const actions = listAt(body, 'actions', 'actions possibles de l’admin');
        assertHumanActions(actions, 'admin');
        const suspend = actions.find((a) => a.to === 'SUSPENDU');
        assert.ok(suspend, `admin sur un événement PUBLIE : action SUSPENDU proposée (table D1) : ${JSON.stringify(actions)}`);
        assert.equal(suspend.reason_required, true, `suspension : motif obligatoire (D1) : ${JSON.stringify(suspend)}`);
    });

    test('lot 9 bis (R2, T29) : admin sans permission → 403 PERMISSION_MISSING sur l’aperçu et les ventes, sans aucun chiffre', async () => {
        for (const tab of ['overview', 'sales'] as const) {
            const res = await pilotageGet(adminBare, ds.eventId, tab);
            assert.equal(res.status, 403, `R2 : admin sans permission, pilotage/${tab} → 403 attendu : ${show(res)}`);
            assert.equal(res.body.code, 'PERMISSION_MISSING', `admin sans permission, pilotage/${tab} : ${show(res)}`);
            for (const key of ['tickets', 'revenue', 'entries', 'by_category', 'by_day', 'actions']) {
                assert.equal(res.body[key], undefined, `admin sans permission, pilotage/${tab} : aucune donnée (${key}) : ${show(res)}`);
            }
        }
    });
});

describe('5.10 Ventes : GET …/pilotage/sales', () => {
    test('par catégorie : vendus, en cours de paiement, restants (Standard, VIP, Étudiant) ; catégorie inactive sans vente', async () => {
        const body = await pilotageOk(ds.partner, ds.eventId, 'sales', 'le partenaire propriétaire');
        const rows = listAt(body, 'by_category', 'ventes par catégorie');
        for (const name of [STANDARD, VIP, ETUDIANT]) {
            const row = findItem(rows, 'category_id', ds.categoryIds[name], `catégorie ${name}`);
            const exp = EXPECTED.byCategory[name];
            assert.equal(row.name, name, `catégorie ${name} : nom`);
            assert.equal(numberAt(row, 'sold', `${name} : vendus`), exp.sold, `${name} : vendus (hors invitation, hors remboursé)`);
            assert.equal(numberAt(row, 'in_payment', `${name} : en cours`), exp.in_payment, `${name} : en cours de paiement`);
            assert.equal(numberAt(row, 'remaining', `${name} : restants`), exp.remaining, `${name} : restants = quota − vendus − invitations − en cours`);
        }
        const closed = rows.find((r) => r.category_id === ds.categoryIds[PREVENTE]);
        if (closed) {
            assert.equal(numberAt(closed, 'sold', 'Prévente : vendus'), 0, 'catégorie inactive : aucune vente');
            assert.equal(numberAt(closed, 'in_payment', 'Prévente : en cours'), 0, 'catégorie inactive : aucun panier');
        }
    });

    test('Σ par catégorie = totaux de l’aperçu (une seule source de vérité)', async () => {
        const sales = await pilotageOk(ds.partner, ds.eventId, 'sales', 'le partenaire propriétaire');
        const overview = await pilotageOk(ds.partner, ds.eventId, 'overview', 'le partenaire propriétaire');
        const rows = listAt(sales, 'by_category', 'ventes par catégorie')
            .filter((r) => [STANDARD, VIP, ETUDIANT].some((n) => ds.categoryIds[n] === r.category_id));
        assert.equal(rows.length, 3, `les trois catégories actives : ${JSON.stringify(rows)}`);
        const total = (key: string) => rows.reduce((s, r) => s + numberAt(r, key, key), 0);
        assert.equal(total('sold'), numberAt(overview, 'tickets.sold', 'vendus'), 'Σ vendus par catégorie = vendus de l’aperçu');
        assert.equal(total('in_payment'), numberAt(overview, 'tickets.in_payment', 'en cours'), 'Σ en cours par catégorie = aperçu');
        assert.equal(total('remaining'), numberAt(overview, 'tickets.remaining', 'restants'), 'Σ restants par catégorie = aperçu');
        assert.equal(total('sold'), EXPECTED.tickets.sold);
        assert.equal(total('remaining'), EXPECTED.tickets.remaining);
    });

    test('jour par jour en Africa/Dakar : chaque jour = billets vendus émis ce jour-là, Σ = vendus, ordre chronologique', async () => {
        // Jours attendus : horodatages bruts des billets vendus du jeu (hors invitation, hors remboursé)
        const expectedByDay = new Map<string, number>();
        for (const t of await eventTicketRows(ds.eventId)) {
            if ((t.status === 'VALIDE' || t.status === 'UTILISE') && t.sale_channel !== 'INVITATION') {
                const day = dakarDay(t.created_at);
                expectedByDay.set(day, (expectedByDay.get(day) ?? 0) + 1);
            }
        }
        assert.equal(Array.from(expectedByDay.values()).reduce((s, n) => s + n, 0), EXPECTED.tickets.sold, 'garde-fou : jeu de 10 billets vendus');

        const body = await pilotageOk(ds.partner, ds.eventId, 'sales', 'le partenaire propriétaire');
        const days = listAt(body, 'by_day', 'ventes jour par jour');
        const seen = new Map<string, number>();
        for (const d of days) {
            assert.match(String(d.day), /^\d{4}-\d{2}-\d{2}$/, `jour au format AAAA-MM-JJ : ${JSON.stringify(d)}`);
            assert.ok(!seen.has(String(d.day)), `jour ${d.day} en double : ${JSON.stringify(days)}`);
            seen.set(String(d.day), numberAt(d, 'sold', `ventes du ${d.day}`));
        }
        const order = days.map((d) => String(d.day));
        assert.deepEqual(order, [...order].sort(), `jours dans l’ordre chronologique : ${JSON.stringify(order)}`);
        for (const [day, n] of Array.from(expectedByDay)) {
            assert.equal(seen.get(day), n, `ventes du ${day} (Dakar) : ${n} attendue(s), reçu ${JSON.stringify(days)}`);
        }
        for (const [day, n] of Array.from(seen)) {
            if (!expectedByDay.has(day)) assert.equal(n, 0, `jour ${day} sans vente dans le jeu : 0 attendu, reçu ${n}`);
        }
    });
});
