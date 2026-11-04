/**
 * Lot 7, tâche 7.4 — parcours partenaire (contrat, section 8 ; API 3.8 ; décisions D65, D66, D69, D70) :
 * écrans migrés, états vide, chargement et erreur, première utilisation, chiffres servis par le serveur,
 * défauts fonctionnels relevés à la découverte (discovery-7-partenaire.md, sections 2.2 à 2.8).
 *
 * Serveur (routes appelées dans le processus du test, jeu de données propre à chaque cas) :
 *  1. GET /api/partner/dashboard → `onboarding: { visible, steps:[{ key, done, href }] }` (8 clés PROFILE,
 *     CREATE, POSTER, CATEGORY, SUBMIT, VALIDATED, PUBLISH, CONTROLLERS) : visible pour un partenaire VALIDE
 *     sans événement, étapes cochées par le serveur au fil de la création (brouillon sans affiche ni
 *     catégorie), de l'affiche, d'une catégorie active, de la soumission, de la validation ; invisible après
 *     la publication, avec un événement TERMINE, et pour un partenaire EN_ATTENTE ou REJETE ; le motif d'un
 *     refus (partner_status_set) est servi pour le bandeau REJETE ;
 *  2. même route → `trial: { days, ends_at }` : 90 jours pour un fondateur, 60 sinon, fin = partners.trial_ends_at ;
 *  3. GET /api/partner/subscription → `trial_percent_used` entier (25, 33, 100 pour un essai échu) ;
 *  4. GET /api/partner/team/all → `members_count`, `assignments_count`, `members[].assignments`,
 *     `assignable_events` (VALIDE et PUBLIE seulement, `start_at` = event_start_at), sans rien d'un autre
 *     partenaire ;
 *  5. GET /api/finance/balance?account=ORGANISATEUR → `effective_status` de chaque retrait (statut du retrait
 *     corrigé par l'issue de son cashout, règle aujourd'hui recalculée par la page) et `is_pending` de chaque
 *     écriture (horloge du serveur, aujourd'hui `isFuture` du téléphone).
 * Statique (commentaires exclus ; la page, ses imports locaux sous app/partner/ et components/partner/) :
 *  6. dans les 4 pages (tableau de bord, finances, équipe, abonnement) et FirstEventSteps : aucun reduce,
 *     filter(…).length, new Set(…).size, Math.round/ceil/floor, `? 90 : 60` ni repli `|| 60`, aucune
 *     lecture directe de table ni RPC, aucun `.length` affiché ; ErrorState (avec onRetry) et état vide ;
 *     contenus propres à chaque page (section 8) ; usePartnerOrders toujours importé (SCENARIO 15) et
 *     finance-moteur.test.ts:273 respecté (garde-fous verts).
 *
 * Rouge avant correctif (fix(7.4)) :
 *  - aucune des routes ne sert `onboarding`, `trial`, `trial_percent_used`, `members_count`,
 *    `assignments_count`, `assignable_events`, `effective_status`, `is_pending` (lib/partner/
 *    partner-dashboard.service.ts:543-576, app/api/partner/subscription/route.ts:49-63,
 *    app/api/partner/team/all/route.ts:126-147, lib/finance/ledger.ts:44-67) ; le motif de refus n'est pas
 *    dans la réponse du tableau de bord (fiche réduite à id, noms, contact, statut) ;
 *  - pages : `is_founder ? 90 : 60` (dashboard:96), `'0 FCFA'` sans donnée (dashboard:156-180), « Commissions
 *    EV » (dashboard:165), `<table>` (dashboard:371, team:537), `{ev.status}` brut, aucun bandeau REJETE ;
 *    `new Set(…).size` et `controllers.length` affichés (team:212,458), modales `fixed inset-0`
 *    (team:888,1039), éligibilité décidée dans le navigateur (team:17) ; `Math.round` (subscription:113),
 *    PLAN_HIGHLIGHTS (subscription:38-62), `billing_period` brut ; isFuture / Date.now (finance:231-235),
 *    formatFcfa importé de PaymentModal, pas d'OtpInput ; components/partner/onboarding/FirstEventSteps.tsx absent.
 * Garde-fous verts sur le code actuel (signalés) : usePartnerOrders importé par le tableau de bord ;
 * finances sans `* 0.01` ni « 1.5 % ».
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import type { NextRequest } from 'next/server';
import { WithdrawalService } from '../../lib/payments/withdrawal.service';
import { fakePay, importModule, newBuyer, service, setFakeMode, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, createPartnerEvent, jsonRequest, newPartner, superadminId, withSettings, type Purchase, type TestPartner } from './finance-helpers';
import { assignController, newController } from './acces-helpers';
import { advanceEventTo, createDraftEvent, createEventInStatus, posterUrl } from './cycle-helpers';
import { assertTerrainInvariants } from './terrain-helpers';

const DAY = 24 * 3600_000;
const CATS: CategorySpec[] = [{ name: 'Standard', price: 5_000, total: 30 }];
const ONBOARDING_KEYS = ['PROFILE', 'CREATE', 'POSTER', 'CATEGORY', 'SUBMIT', 'VALIDATED', 'PUBLISH', 'CONTROLLERS'] as const;
type StepKey = (typeof ONBOARDING_KEYS)[number];

const DASHBOARD_ROUTE = '../../app/api/partner/dashboard/route';
const SUBSCRIPTION_ROUTE = '../../app/api/partner/subscription/route';
const TEAM_ROUTE = '../../app/api/partner/team/all/route';
const BALANCE_ROUTE = '../../app/api/finance/balance/route';

after(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = 10_000_000;
    await assertTerrainInvariants('partenaire-lot7');
});

// ── Outils ─────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

interface RouteResult {
    status: number;
    body: Row;
}

async function callGet(modulePath: string, req: NextRequest): Promise<RouteResult> {
    const mod = await importModule(modulePath);
    const handler = mod.GET as Handler | undefined;
    assert.equal(typeof handler, 'function', `${modulePath} : pas de handler GET`);
    const res = await handler!(req);
    const text = await res.text();
    let body: Row;
    try {
        body = text ? (JSON.parse(text) as Row) : {};
    } catch {
        body = { raw: text.slice(0, 300) }; // corps non JSON conservé tel quel pour le message d'échec
    }
    return { status: res.status, body };
}

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 700)}`;
}

function isRecord(v: unknown): v is Row {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function sameInstant(actual: unknown, expected: unknown, what: string, toleranceMs = 1000): void {
    const a = Date.parse(String(actual));
    const e = expected instanceof Date ? expected.getTime() : Date.parse(String(expected));
    assert.ok(!Number.isNaN(a), `${what} : instant illisible (${JSON.stringify(actual)})`);
    assert.ok(!Number.isNaN(e), `${what} : instant attendu illisible (${JSON.stringify(expected)})`);
    assert.ok(Math.abs(a - e) <= toleranceMs, `${what} : ${new Date(a).toISOString()} au lieu de ${new Date(e).toISOString()}`);
}

/** Tableau de bord du partenaire : `dashboard` (ou `data`, alias de la route actuelle). */
async function dashboardOf(p: TestPartner, what: string): Promise<Row> {
    const res = await callGet(DASHBOARD_ROUTE, jsonRequest('/api/partner/dashboard', 'GET', p.accessToken));
    assert.equal(res.status, 200, `${what} : GET /api/partner/dashboard ${show(res)}`);
    const d = isRecord(res.body.dashboard) ? res.body.dashboard : isRecord(res.body.data) ? res.body.data : null;
    assert.ok(d, `${what} : réponse sans objet dashboard ${show(res)}`);
    return d;
}

interface Onboarding {
    visible: boolean;
    steps: Map<StepKey, { done: boolean; href: string }>;
}

/** `onboarding` du contrat 3.8 : visible booléen, les 8 étapes exactement, done booléen, href interne. */
async function onboardingOf(p: TestPartner, what: string): Promise<Onboarding> {
    const d = await dashboardOf(p, what);
    const o = d.onboarding;
    assert.ok(isRecord(o), `${what} : dashboard.onboarding absent (contrat 3.8, D70) — clés servies : ${Object.keys(d).join(', ')}`);
    assert.equal(typeof o.visible, 'boolean', `${what} : onboarding.visible booléen attendu (${JSON.stringify(o.visible)})`);
    assert.ok(Array.isArray(o.steps), `${what} : onboarding.steps tableau attendu (${JSON.stringify(o.steps)})`);
    const steps = new Map<StepKey, { done: boolean; href: string }>();
    for (const s of o.steps as unknown[]) {
        assert.ok(isRecord(s), `${what} : étape non objet (${JSON.stringify(s)})`);
        const key = String(s.key) as StepKey;
        assert.ok((ONBOARDING_KEYS as readonly string[]).includes(key), `${what} : étape inconnue « ${String(s.key)} » (clés du contrat : ${ONBOARDING_KEYS.join(', ')})`);
        assert.ok(!steps.has(key), `${what} : étape ${key} en double`);
        assert.equal(typeof s.done, 'boolean', `${what} : étape ${key}, done booléen attendu (${JSON.stringify(s.done)})`);
        assert.equal(typeof s.href, 'string', `${what} : étape ${key}, href attendu (${JSON.stringify(s.href)})`);
        assert.match(String(s.href), /^\/partner\//, `${what} : étape ${key}, lien interne de l'espace partenaire attendu (${String(s.href)})`);
        steps.set(key, { done: s.done as boolean, href: String(s.href) });
    }
    assert.deepEqual(Array.from(steps.keys()).sort(), [...ONBOARDING_KEYS].sort(), `${what} : les 8 étapes du contrat exactement`);
    return { visible: o.visible as boolean, steps };
}

/** État coché des 6 étapes de la création à la publication (PROFILE et CONTROLLERS ne sont pas pilotés ici). */
function progress(o: Onboarding): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const k of ['CREATE', 'POSTER', 'CATEGORY', 'SUBMIT', 'VALIDATED', 'PUBLISH'] as const) out[k] = o.steps.get(k)!.done;
    return out;
}

function expectedProgress(doneUpTo: number): Record<string, boolean> {
    const order = ['CREATE', 'POSTER', 'CATEGORY', 'SUBMIT', 'VALIDATED', 'PUBLISH'];
    return Object.fromEntries(order.map((k, i) => [k, i < doneUpTo]));
}

async function partnerRow(p: TestPartner): Promise<Row> {
    const { data, error } = await service.from('partners').select('*').eq('id', p.partnerId).single();
    assert.equal(error, null, `fiche partenaire ${p.partnerId} : ${error?.message}`);
    return data as Row;
}

async function updatePartner(p: TestPartner, values: Row, what: string): Promise<void> {
    const { error } = await service.from('partners').update(values).eq('id', p.partnerId);
    assert.equal(error, null, `${what} : ${error?.message}`);
}

// ── 1. Première utilisation ────────────────────────────────────────────────

describe('7.4 Première utilisation : onboarding servi par /api/partner/dashboard (D70)', () => {
    test('partenaire VALIDE sans événement : carte visible, aucune étape de création cochée', async () => {
        const p = await newPartner('p7-onb-neuf');
        const o = await onboardingOf(p, 'partenaire VALIDE sans événement');
        assert.equal(o.visible, true, 'carte de première utilisation visible pour un partenaire VALIDE sans événement');
        assert.deepEqual(progress(o), expectedProgress(0), 'aucune étape cochée avant la création');
    });

    test('étapes cochées par le serveur : création, affiche, catégorie, soumission, validation ; invisible après la publication', async () => {
        const p = await newPartner('p7-onb-suite');
        const ev = await createDraftEvent(p, 'p7-onb-suite', [], { imageUrl: null, startsInHours: 72 });

        let o = await onboardingOf(p, 'brouillon sans affiche ni catégorie');
        assert.equal(o.visible, true, 'brouillon : carte toujours visible');
        assert.deepEqual(progress(o), expectedProgress(1), 'brouillon créé : seule l’étape CREATE est cochée');

        const { error: imgErr } = await service.from('events').update({ image_url: posterUrl(p.partnerId) }).eq('id', ev.eventId);
        assert.equal(imgErr, null, `affiche du brouillon : ${imgErr?.message}`);
        o = await onboardingOf(p, 'brouillon avec affiche');
        assert.deepEqual(progress(o), expectedProgress(2), 'affiche ajoutée : POSTER cochée');

        const { error: catErr } = await service.from('ticket_categories').insert({
            event_id: ev.eventId, name: 'Standard', price: 5_000, total_quantity: 30, sold_quantity: 0,
            is_active: true, is_visible: true, max_per_order: 10,
        });
        assert.equal(catErr, null, `catégorie du brouillon : ${catErr?.message}`);
        o = await onboardingOf(p, 'brouillon avec affiche et catégorie');
        assert.deepEqual(progress(o), expectedProgress(3), 'catégorie active ajoutée : CATEGORY cochée');

        await advanceEventTo(ev.eventId, 'EN_ATTENTE', { partnerUserId: p.userId });
        o = await onboardingOf(p, 'événement soumis');
        assert.equal(o.visible, true, 'soumis : carte toujours visible');
        assert.deepEqual(progress(o), expectedProgress(4), 'soumission : SUBMIT cochée');

        await advanceEventTo(ev.eventId, 'VALIDE', { partnerUserId: p.userId });
        o = await onboardingOf(p, 'événement validé');
        assert.equal(o.visible, true, 'validé mais pas publié : carte toujours visible');
        assert.deepEqual(progress(o), expectedProgress(5), 'validation : VALIDATED cochée, PUBLISH non');

        await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: p.userId });
        o = await onboardingOf(p, 'événement publié');
        assert.equal(o.visible, false, 'premier événement publié : la carte disparaît');
        assert.equal(o.steps.get('PUBLISH')!.done, true, 'publication : PUBLISH cochée');
    });

    test('invisible avec un événement TERMINE', async () => {
        const p = await newPartner('p7-onb-termine');
        await createEventInStatus(p, 'p7-onb-termine', CATS, 'TERMINE', { startsInHours: 48, finishShift: { startsInHours: -6, durationHours: 2 } });
        const o = await onboardingOf(p, 'partenaire avec un événement TERMINE');
        assert.equal(o.visible, false, 'un événement déjà TERMINE : pas de carte de première utilisation');
    });

    test('invisible pour un partenaire EN_ATTENTE ou REJETE ; le motif du refus est servi pour le bandeau REJETE', async () => {
        const pending = await newPartner('p7-onb-attente');
        await updatePartner(pending, { status: 'EN_ATTENTE', is_verified: false }, 'partenaire remis EN_ATTENTE');
        const oPending = await onboardingOf(pending, 'partenaire EN_ATTENTE');
        assert.equal(oPending.visible, false, 'partenaire EN_ATTENTE : pas de carte (il ne peut pas encore créer)');

        const rejected = await newPartner('p7-onb-refus');
        const reason = `Pièce d’identité illisible ${randomUUID().slice(0, 8)}`;
        const { data, error } = await service.rpc('partner_status_set', { p: { partner_id: rejected.partnerId, actor_id: await superadminId(), status: 'REJETE', reason } });
        assert.equal(error, null, `partner_status_set REJETE : ${error?.message}`);
        assert.equal((data as Row | null)?.ok, true, `partner_status_set REJETE refusé : ${JSON.stringify(data)}`);
        const d = await dashboardOf(rejected, 'partenaire REJETE');
        assert.ok(JSON.stringify(d).includes(reason), `partenaire REJETE : motif du refus absent de la réponse du tableau de bord (bandeau REJETE avec motif, section 8) — ${JSON.stringify(d.partner)}`);
        const oRejected = await onboardingOf(rejected, 'partenaire REJETE');
        assert.equal(oRejected.visible, false, 'partenaire REJETE : pas de carte de première utilisation');
    });
});

// ── 2. Durée de l'essai ────────────────────────────────────────────────────

describe('7.4 Essai : trial { days, ends_at } servi par /api/partner/dashboard', () => {
    for (const [founder, days] of [[true, 90], [false, 60]] as const) {
        test(`${founder ? 'fondateur' : 'partenaire ordinaire'} : trial.days = ${days}, trial.ends_at = fin d’essai en base`, async () => {
            const p = await newPartner(`p7-essai-${founder ? 'fond' : 'std'}`);
            await updatePartner(p, { is_founder: founder }, 'fondateur');
            const { data, error } = await service.rpc('activate_partner_trial', { p_partner_id: p.partnerId });
            assert.equal(error, null, `activate_partner_trial : ${error?.message}`);
            assert.equal((data as Row | null)?.success, true, `activation de l'essai : ${JSON.stringify(data)}`);
            const row = await partnerRow(p);
            assert.ok(row.trial_ends_at, 'fin d’essai posée par activate_partner_trial');

            const d = await dashboardOf(p, `essai ${founder ? 'fondateur' : 'ordinaire'}`);
            assert.ok(isRecord(d.trial), `dashboard.trial absent (contrat 3.8) — clés servies : ${Object.keys(d).join(', ')}`);
            assert.equal(d.trial.days, days, `trial.days : ${days} jours ${founder ? 'pour un fondateur' : 'hors fondateur'} (règle de activate_partner_trial)`);
            sameInstant(d.trial.ends_at, row.trial_ends_at, 'trial.ends_at = partners.trial_ends_at');
        });
    }
});

// ── 3. Pourcentage de l'essai consommé ─────────────────────────────────────

describe('7.4 Abonnement : trial_percent_used servi par /api/partner/subscription (D65)', () => {
    const cases: Array<{ label: string; founder: boolean; startedDaysAgo: number; endsInDays: number; expected: number }> = [
        { label: 'ordinaire, 15 jours sur 60', founder: false, startedDaysAgo: 15, endsInDays: 45, expected: 25 },
        { label: 'fondateur, 30 jours sur 90', founder: true, startedDaysAgo: 30, endsInDays: 60, expected: 33 },
        { label: 'essai échu depuis 10 jours', founder: false, startedDaysAgo: 70, endsInDays: -10, expected: 100 },
    ];
    for (const c of cases) {
        test(`${c.label} : trial_percent_used = ${c.expected}`, async () => {
            const p = await newPartner(`p7-abo-${c.expected}`);
            const now = Date.now();
            await updatePartner(p, {
                is_founder: c.founder,
                trial_started_at: new Date(now - c.startedDaysAgo * DAY).toISOString(),
                trial_ends_at: new Date(now + c.endsInDays * DAY).toISOString(),
            }, 'dates de l’essai');
            const res = await callGet(SUBSCRIPTION_ROUTE, jsonRequest('/api/partner/subscription', 'GET', p.accessToken));
            assert.equal(res.status, 200, `GET /api/partner/subscription ${show(res)}`);
            const sub = isRecord(res.body.subscription) ? res.body.subscription : {};
            const value = sub.trial_percent_used ?? res.body.trial_percent_used;
            assert.notEqual(value, undefined, `trial_percent_used absent de la réponse (contrat 3.8 ; la page le calcule par Math.round, subscription:113) ${show(res)}`);
            assert.ok(Number.isInteger(value), `trial_percent_used entier attendu (${JSON.stringify(value)})`);
            assert.equal(value, c.expected, `trial_percent_used (${c.label})`);
        });
    }
});

// ── 4. Équipe ──────────────────────────────────────────────────────────────

function memberUserId(m: Row): string | null {
    for (const k of ['user_id', 'controller_id']) if (typeof m[k] === 'string') return m[k] as string;
    for (const k of ['users', 'user']) if (isRecord(m[k]) && typeof (m[k] as Row).id === 'string') return (m[k] as Row).id as string;
    return typeof m.id === 'string' ? m.id : null;
}

function assignmentEventId(a: Row): string | null {
    if (typeof a.event_id === 'string') return a.event_id;
    for (const k of ['event', 'events']) if (isRecord(a[k]) && typeof (a[k] as Row).id === 'string') return (a[k] as Row).id as string;
    return null;
}

describe('7.4 Équipe : comptages et événements assignables servis par /api/partner/team/all (D66)', () => {
    let partnerA: TestPartner;
    let partnerB: TestPartner;
    const evA: Record<string, string> = {};
    let evBPublie: string;
    let startAt: Record<string, Date>;
    let c1: string;
    let c2: string;

    before(async () => {
        partnerA = await newPartner('p7-equipe-a');
        partnerB = await newPartner('p7-equipe-b');
        for (const status of ['BROUILLON', 'EN_ATTENTE', 'VALIDE', 'PUBLIE', 'ANNULE'] as const) {
            evA[status] = (await createEventInStatus(partnerA, `p7-equipe-${status.toLowerCase()}`, CATS, status, { startsInHours: 48 + Object.keys(evA).length })).eventId;
        }
        evBPublie = (await createEventInStatus(partnerB, 'p7-equipe-b-publie', CATS, 'PUBLIE', { startsInHours: 60 })).eventId;
        startAt = {};
        for (const status of ['VALIDE', 'PUBLIE']) {
            const { data, error } = await service.rpc('event_start_at', { p_event: evA[status] });
            assert.equal(error, null, `event_start_at : ${error?.message}`);
            startAt[status] = new Date(String(data));
        }
        c1 = (await newController(partnerA, evA.PUBLIE, { label: 'p7-eq-1' })).userId;
        await assignController(partnerA, c1, evA.VALIDE, false);
        await assignController(partnerB, c1, evBPublie, false);
        c2 = (await newController(partnerA, evA.PUBLIE, { label: 'p7-eq-2' })).userId;
    });

    test('members_count, assignments_count et affectations groupées par contrôleur, sans rien du partenaire B', async () => {
        const res = await callGet(TEAM_ROUTE, jsonRequest('/api/partner/team/all', 'GET', partnerA.accessToken));
        assert.equal(res.status, 200, `GET /api/partner/team/all ${show(res)}`);
        assert.equal(res.body.members_count, 2, `members_count : 2 contrôleurs distincts (aujourd'hui new Set(…).size dans la page, team:212) ${show(res)}`);
        assert.equal(res.body.assignments_count, 3, `assignments_count : 3 affectations sur les événements de A (l'affectation de c1 chez B exclue) ${show(res)}`);
        assert.ok(Array.isArray(res.body.members), `members[] attendu (contrat 3.8) ${show(res)}`);
        const members = res.body.members as Row[];
        assert.equal(members.length, 2, 'deux membres');
        const byUser = new Map(members.map((m) => [memberUserId(m), m]));
        for (const [uid, expected] of [[c1, [evA.PUBLIE, evA.VALIDE]], [c2, [evA.PUBLIE]]] as const) {
            const m = byUser.get(uid);
            assert.ok(m, `membre ${uid} absent de members[] (identifiants servis : ${Array.from(byUser.keys()).join(', ')})`);
            assert.ok(Array.isArray(m.assignments), `members[].assignments attendu pour ${uid} : ${JSON.stringify(m).slice(0, 300)}`);
            const events = (m.assignments as Row[]).map(assignmentEventId).sort();
            assert.deepEqual(events, [...expected].sort(), `affectations du contrôleur ${uid} (événements de A seulement)`);
        }
        assert.ok(!JSON.stringify(res.body).includes(evBPublie), 'aucune trace de l’événement du partenaire B');
    });

    test('assignable_events : événements VALIDE et PUBLIE seulement, avec id, title et start_at', async () => {
        const res = await callGet(TEAM_ROUTE, jsonRequest('/api/partner/team/all', 'GET', partnerA.accessToken));
        assert.equal(res.status, 200, `GET /api/partner/team/all ${show(res)}`);
        assert.ok(Array.isArray(res.body.assignable_events), `assignable_events[] attendu (contrat 3.8 ; aujourd'hui l'éligibilité est décidée dans la page, team:17) ${show(res)}`);
        const list = res.body.assignable_events as Row[];
        assert.deepEqual(list.map((e) => String(e.id)).sort(), [evA.VALIDE, evA.PUBLIE].sort(), 'assignables : VALIDE et PUBLIE, ni BROUILLON, ni EN_ATTENTE, ni ANNULE');
        for (const status of ['VALIDE', 'PUBLIE']) {
            const e = list.find((x) => x.id === evA[status])!;
            assert.equal(typeof e.title, 'string', `événement ${status} : title attendu`);
            assert.ok(String(e.title).length > 0, `événement ${status} : title non vide`);
            sameInstant(e.start_at, startAt[status], `événement ${status} : start_at = event_start_at`);
        }
    });

    test('partenaire B : ses propres comptages (1 membre, 1 affectation, 1 événement assignable)', async () => {
        const res = await callGet(TEAM_ROUTE, jsonRequest('/api/partner/team/all', 'GET', partnerB.accessToken));
        assert.equal(res.status, 200, `GET /api/partner/team/all (B) ${show(res)}`);
        assert.equal(res.body.members_count, 1, `B : members_count ${show(res)}`);
        assert.equal(res.body.assignments_count, 1, `B : assignments_count ${show(res)}`);
        assert.ok(Array.isArray(res.body.assignable_events), `B : assignable_events[] attendu ${show(res)}`);
        assert.deepEqual((res.body.assignable_events as Row[]).map((e) => String(e.id)), [evBPublie], 'B : son seul événement PUBLIE');
        for (const id of Object.values(evA)) assert.ok(!JSON.stringify(res.body).includes(id), `B : aucune trace de l’événement ${id} de A`);
    });
});

// ── 5. Finances ────────────────────────────────────────────────────────────

/** Statut effectif d'un retrait : la règle que la page applique aujourd'hui (finance:181-183), à servir. */
function effectiveOf(status: string, cashoutStatus: string | null): string {
    if (status === 'PROCESSING' && cashoutStatus === 'CONFIRME') return 'PAID';
    if (status === 'PROCESSING' && cashoutStatus === 'ECHOUE') return 'REJECTED';
    return status;
}

describe('7.4 Finances : effective_status et is_pending servis par /api/finance/balance', () => {
    let partner: TestPartner;
    let available: Purchase;
    let held: Purchase;
    const withdrawals: Record<'paid' | 'rejected' | 'uncertain', string> = { paid: '', rejected: '', uncertain: '' };

    async function withdraw(mode: 'success' | 'rejected' | 'timeout-after-send', amount: number): Promise<string> {
        setFakeMode('cashoutMode', mode);
        try {
            const out = await WithdrawalService.request({
                userId: partner.userId, account: 'ORGANISATEUR', amount, method: 'MOBILE_MONEY', operator: 'WAVE',
                phoneNumber: partner.phone9, clientKey: randomUUID(), otpVerifiedAt: new Date().toISOString(),
            });
            assert.equal(out.ok, true, `retrait (${mode}) : ${JSON.stringify(out)}`);
            return (out as { withdrawalId: string }).withdrawalId;
        } finally {
            setFakeMode('cashoutMode', 'success');
        }
    }

    before(async () => {
        fakePay().balance = 10_000_000; // solde du faux SamirPay : aucun envoi bloqué par SOLDE_INSUFFISANT
        partner = await newPartner('p7-finances');
        const ev = await createPartnerEvent(partner.partnerId, 'p7-finances', [{ name: 'Standard', price: 20_000, total: 10 }], { daysFromNow: 30 });
        available = await withSettings({ 'finance.payout_hold_enabled': false }, async () => buyConfirmed(await newBuyer('p7-fin-dispo'), ev, [['Standard', 1]]));
        held = await withSettings({ 'finance.payout_hold_enabled': true }, async () => buyConfirmed(await newBuyer('p7-fin-garde'), ev, [['Standard', 1]]));
        await withSettings({ 'finance.withdrawal_fee_rate': 1, 'finance.withdrawal_min_amount': 5000, 'finance.withdrawal_bank_enabled': false }, async () => {
            withdrawals.paid = await withdraw('success', 6_000);
            withdrawals.rejected = await withdraw('rejected', 6_000);
            withdrawals.uncertain = await withdraw('timeout-after-send', 6_000);
        });
    });

    test('chaque retrait porte effective_status, égal au statut corrigé par l’issue de son cashout (PAID, REJECTED, PROCESSING)', async () => {
        const res = await callGet(BALANCE_ROUTE, jsonRequest('/api/finance/balance?account=ORGANISATEUR', 'GET', partner.accessToken));
        assert.equal(res.status, 200, `GET /api/finance/balance ${show(res)}`);
        assert.ok(Array.isArray(res.body.withdrawals), `withdrawals[] attendu ${show(res)}`);
        const list = res.body.withdrawals as Row[];
        assert.equal(list.length, 3, 'trois retraits');
        const { data: rows, error } = await service.from('withdrawals').select('id, status, cashout_id').eq('user_id', partner.userId);
        assert.equal(error, null, `retraits en base : ${error?.message}`);
        const truth = new Map<string, string>();
        for (const w of rows ?? []) {
            let cashout: string | null = null;
            if (w.cashout_id) {
                const { data: c, error: cErr } = await service.from('cashouts').select('status').eq('id', w.cashout_id).single();
                assert.equal(cErr, null, `cashout du retrait ${w.id} : ${cErr?.message}`);
                cashout = String(c.status);
            }
            truth.set(String(w.id), effectiveOf(String(w.status), cashout));
        }
        for (const w of list) {
            assert.ok('effective_status' in w, `retrait ${String(w.id)} sans effective_status (la page le recalcule aujourd'hui, finance:181-183) : ${JSON.stringify(w).slice(0, 300)}`);
            assert.equal(w.effective_status, truth.get(String(w.id)), `retrait ${String(w.id)} : effective_status`);
        }
        const byId = new Map(list.map((w) => [String(w.id), w.effective_status]));
        assert.equal(byId.get(withdrawals.paid), 'PAID', 'envoi confirmé : PAID');
        assert.equal(byId.get(withdrawals.rejected), 'REJECTED', 'envoi refusé : REJECTED');
        assert.equal(byId.get(withdrawals.uncertain), 'PROCESSING', 'issue incertaine : PROCESSING (jamais PAID ni REJECTED)');
    });

    test('chaque écriture porte is_pending, décidé à l’horloge du serveur (vente sous garde : true ; vente disponible : false)', async () => {
        const askedAt = Date.now();
        const res = await callGet(BALANCE_ROUTE, jsonRequest('/api/finance/balance?account=ORGANISATEUR', 'GET', partner.accessToken));
        assert.equal(res.status, 200, `GET /api/finance/balance ${show(res)}`);
        assert.ok(Array.isArray(res.body.history), `history[] attendu ${show(res)}`);
        const history = res.body.history as Row[];
        assert.ok(history.length >= 2, `au moins les deux ventes dans l'historique (${history.length})`);
        for (const e of history) {
            assert.equal(typeof e.is_pending, 'boolean', `écriture ${String(e.id)} (${String(e.entry_type)}) sans is_pending booléen (aujourd'hui isFuture du téléphone, finance:231-235) : ${JSON.stringify(e).slice(0, 300)}`);
            const at = Date.parse(String(e.available_at));
            if (!Number.isNaN(at) && Math.abs(at - askedAt) > 10_000) {
                assert.equal(e.is_pending, at > askedAt, `écriture ${String(e.id)} (${String(e.entry_type)}, disponible le ${String(e.available_at)}) : is_pending`);
            }
        }
        const sale = (pid: unknown) => history.find((e) => e.entry_type === 'VENTE' && e.payment_id === pid);
        assert.equal(sale(held.payment.id)?.is_pending, true, 'vente sous garde (fin de l’événement + délai) : en attente');
        assert.equal(sale(available.payment.id)?.is_pending, false, 'vente sans garde : disponible');
    });
});

// ── 6. Contrôles statiques des écrans ──────────────────────────────────────

const ROOT = process.cwd();
const printer = ts.createPrinter({ removeComments: true });
const sfCache = new Map<string, ts.SourceFile>();

const DASHBOARD_PAGE = 'app/partner/dashboard/page.tsx';
const FINANCE_PAGE = 'app/partner/finance/page.tsx';
const TEAM_PAGE = 'app/partner/team/page.tsx';
const SUBSCRIPTION_PAGE = 'app/partner/subscription/page.tsx';
const FIRST_STEPS = 'components/partner/onboarding/FirstEventSteps.tsx';

function absPath(rel: string): string {
    return path.join(ROOT, ...rel.split('/'));
}

function isFile(rel: string): boolean {
    const p = absPath(rel);
    return fs.existsSync(p) && fs.statSync(p).isFile();
}

function sourceOf(rel: string): ts.SourceFile {
    let sf = sfCache.get(rel);
    if (!sf) {
        assert.ok(isFile(rel), `${rel} absent`);
        sf = ts.createSourceFile(rel, fs.readFileSync(absPath(rel), 'utf8'), ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        sfCache.set(rel, sf);
    }
    return sf;
}

function codeOf(rel: string): string {
    return printer.printFile(sourceOf(rel));
}

function resolveImport(fromRel: string, spec: string): string | null {
    let base: string;
    if (spec.startsWith('@/')) base = spec.slice(2);
    else if (spec.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
    else return null;
    for (const cand of [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) if (isFile(cand)) return cand;
    return null;
}

interface Binding {
    local: string;
    imported: string;
    spec: string;
    from: string | null;
}

function bindingsOf(rel: string): Binding[] {
    const out: Binding[] = [];
    for (const st of sourceOf(rel).statements) {
        if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || !st.importClause) continue;
        const spec = st.moduleSpecifier.text;
        const from = resolveImport(rel, spec);
        if (st.importClause.name) out.push({ local: st.importClause.name.text, imported: 'default', spec, from });
        const nb = st.importClause.namedBindings;
        if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) out.push({ local: el.name.text, imported: (el.propertyName ?? el.name).text, spec, from });
    }
    return out;
}

/** La page et ses imports locaux propres à l'espace partenaire (app/partner/, components/partner/), récursivement. */
function screenFiles(entry: string): string[] {
    const seen = new Set<string>([entry]);
    let frontier = [entry];
    for (let depth = 0; depth < 6 && frontier.length > 0; depth++) {
        const next: string[] = [];
        for (const f of frontier) {
            for (const b of bindingsOf(f)) {
                const to = b.from;
                if (!to || seen.has(to) || !/\.tsx?$/.test(to)) continue;
                if (!['app/partner/', 'components/partner/'].some((p) => to.startsWith(p))) continue;
                seen.add(to);
                next.push(to);
            }
        }
        frontier = next;
    }
    return Array.from(seen);
}

function lineOf(sf: ts.SourceFile, node: ts.Node): number {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

function walk(sf: ts.SourceFile, fn: (node: ts.Node) => void): void {
    const visit = (node: ts.Node): void => {
        fn(node);
        ts.forEachChild(node, visit);
    };
    visit(sf);
}

/** Textes du fichier : littéraux de chaîne, gabarits et texte JSX. */
function stringsOf(rel: string): string[] {
    const out: string[] = [];
    walk(sourceOf(rel), (node) => {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) out.push(node.text);
        else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) out.push(node.text);
        else if (ts.isJsxText(node) && node.text.trim()) out.push(node.text.replace(/\s+/g, ' ').trim());
    });
    return out;
}

function unwrap(e: ts.Expression): ts.Expression {
    let x = e;
    while (ts.isParenthesizedExpression(x) || ts.isNonNullExpression(x) || ts.isAsExpression(x)) x = x.expression;
    return x;
}

function rootName(e: ts.Expression): string {
    const x = unwrap(e);
    if (ts.isIdentifier(x)) return x.text;
    if (ts.isPropertyAccessExpression(x)) return x.name.text;
    return '';
}

const COMPARISONS = new Set([
    ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.LessThanToken,
    ts.SyntaxKind.GreaterThanEqualsToken, ts.SyntaxKind.LessThanEqualsToken,
]);

/** Un `.length` sert de condition (comparaison, négation, garde de && ou de ?:) plutôt que de valeur affichée. */
function usedAsCondition(node: ts.Node): boolean {
    let child: ts.Node = node;
    let parent = node.parent;
    while (parent && (ts.isParenthesizedExpression(parent) || ts.isNonNullExpression(parent))) {
        child = parent;
        parent = parent.parent;
    }
    if (!parent) return false;
    if (ts.isBinaryExpression(parent) && COMPARISONS.has(parent.operatorToken.kind)) return true;
    if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && parent.left === child) return true;
    if (ts.isPrefixUnaryExpression(parent) && parent.operator === ts.SyntaxKind.ExclamationToken) return true;
    if (ts.isConditionalExpression(parent) && parent.condition === child) return true;
    return false;
}

/** Vrai si le nœud est à l'intérieur d'un enfant JSX `{…}` ou d'un gabarit `${…}` (valeur affichée). */
function insideDisplay(node: ts.Node): boolean {
    for (let p = node.parent; p; p = p.parent) {
        if (ts.isTemplateSpan(p)) return true;
        if (ts.isJsxExpression(p)) return !!p.parent && (ts.isJsxElement(p.parent) || ts.isJsxFragment(p.parent));
        if (ts.isJsxAttribute(p) || ts.isArrowFunction(p) || ts.isFunctionExpression(p) || ts.isFunctionDeclaration(p)) return false;
    }
    return false;
}

/**
 * Chiffres calculés dans le navigateur (section 8, test 6 ; modèle pilotage-acces.test.ts:282-296) : reduce,
 * filter(…).length, new Set(…).size, Math.round/ceil/floor, `? 90 : 60`, repli `|| 60` / `?? 60`, lecture
 * directe d'une table (`.from('<table>')`) ou d'une RPC, `.length` affiché (enfant JSX ou gabarit) hors
 * condition. Exemption : les compteurs de sélection d'un formulaire (`…Ids.length`, et la liste
 * `assignable…` / `available…` qu'ils divisent), admis par la découverte (2.7) comme état du formulaire.
 */
function browserFigures(rel: string): string[] {
    const sf = sourceOf(rel);
    const out: string[] = [];
    const at = (node: ts.Node, what: string) => out.push(`${rel}:${lineOf(sf, node)} ${what} (${node.getText(sf).replace(/\s+/g, ' ').slice(0, 90)})`);
    walk(sf, (node) => {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
            const name = node.expression.name.text;
            const target = unwrap(node.expression.expression);
            if (name === 'reduce') at(node, 'reduce');
            if (ts.isIdentifier(target) && target.text === 'Math' && ['round', 'ceil', 'floor'].includes(name)) at(node, `Math.${name}`);
            if (name === 'from' && node.arguments.length > 0 && (ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))) at(node, 'lecture directe d’une table');
            if (name === 'rpc') at(node, 'appel direct d’une RPC');
        }
        if (ts.isPropertyAccessExpression(node) && node.name.text === 'length') {
            const target = unwrap(node.expression);
            if (ts.isCallExpression(target) && ts.isPropertyAccessExpression(target.expression) && target.expression.name.text === 'filter') at(node, 'filter(…).length');
            else if (insideDisplay(node) && !usedAsCondition(node)) {
                const owner = rootName(node.expression);
                if (!/Ids$/.test(owner) && !/^(assignable|available)/i.test(owner)) at(node, '.length affiché');
            }
        }
        if (ts.isPropertyAccessExpression(node) && node.name.text === 'size') {
            const target = unwrap(node.expression);
            if (ts.isNewExpression(target) && ts.isIdentifier(target.expression) && target.expression.text === 'Set') at(node, 'new Set(…).size');
        }
        if (ts.isConditionalExpression(node)) {
            const a = unwrap(node.whenTrue);
            const b = unwrap(node.whenFalse);
            if (ts.isNumericLiteral(a) && ts.isNumericLiteral(b) && a.text === '90' && b.text === '60') at(node, 'durée d’essai recalculée (? 90 : 60)');
        }
        if (ts.isBinaryExpression(node) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) {
            const r = unwrap(node.right);
            if (ts.isNumericLiteral(r) && r.text === '60') at(node, 'repli inventé (|| 60)');
        }
    });
    return out;
}

/** Fichiers à contrôler pour un écran : la page et ses modules propres (app/partner/, components/partner/). */
function figuresOfScreen(entry: string): string[] {
    return screenFiles(entry).flatMap(browserFigures);
}

interface JsxUse {
    file: string;
    attrs: Map<string, ts.JsxAttribute>;
}

/** Usages JSX du composant `name` importé de l'un des fichiers `componentFiles`. */
function rendered(files: string[], name: string, componentFiles: string[]): JsxUse[] {
    const out: JsxUse[] = [];
    for (const file of files) {
        const locals = new Set(bindingsOf(file).filter((b) => b.imported === name && b.from !== null && componentFiles.includes(b.from)).map((b) => b.local));
        if (locals.size === 0) continue;
        walk(sourceOf(file), (node) => {
            if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && locals.has(node.tagName.getText())) {
                const attrs = new Map<string, ts.JsxAttribute>();
                for (const p of node.attributes.properties) if (ts.isJsxAttribute(p)) attrs.set(p.name.getText(), p);
                out.push({ file, attrs });
            }
        });
    }
    return out;
}

function assertRenders(files: string[], name: string, componentFile: string, what: string): JsxUse[] {
    const uses = rendered(files, name, [componentFile]);
    assert.ok(uses.length > 0, `${what} : ${name} (${componentFile}) n’est rendu par aucun fichier de l’écran (${files.join(', ')})`);
    return uses;
}

function assertErrorAndEmpty(files: string[], what: string): void {
    const err = assertRenders(files, 'ErrorState', 'components/ui/EmptyState.tsx', what);
    assert.ok(err.some((u) => u.attrs.has('onRetry')), `${what} : ErrorState sans onRetry (l’erreur n’offre pas « Réessayer »)`);
    assertRenders(files, 'EmptyState', 'components/ui/EmptyState.tsx', what);
}

function intrinsicTags(files: string[], tag: string): string[] {
    const out: string[] = [];
    for (const file of files) {
        const sf = sourceOf(file);
        walk(sf, (node) => {
            if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText() === tag) out.push(`${file}:${lineOf(sf, node)}`);
        });
    }
    return out;
}

/** Valeur brute affichée : `{x.status}` (ou `{x.status || …}`) en enfant JSX ou dans un gabarit. */
function rawValues(files: string[], props: RegExp): string[] {
    const out: string[] = [];
    for (const file of files) {
        const sf = sourceOf(file);
        walk(sf, (node) => {
            let expr: ts.Expression | undefined;
            if (ts.isJsxExpression(node) && node.expression && node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) expr = node.expression;
            if (ts.isTemplateSpan(node)) expr = node.expression;
            if (!expr) return;
            let e = unwrap(expr);
            if (ts.isBinaryExpression(e) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(e.operatorToken.kind)) e = unwrap(e.left);
            if (ts.isPropertyAccessExpression(e) && props.test(e.name.text)) out.push(`${file}:${lineOf(sf, node)} ${node.getText(sf).slice(0, 80)}`);
        });
    }
    return out;
}

function importsFrom(files: string[], name: string, specRe: RegExp): boolean {
    return files.some((f) => bindingsOf(f).some((b) => b.imported === name && specRe.test(b.spec)));
}

function calls(files: string[], fnName: string): boolean {
    const re = new RegExp(`\\b${fnName}\\s*(<[^>]*>)?\\s*\\(`);
    return files.some((f) => re.test(codeOf(f)));
}

describe('7.4 Écrans partenaire : chiffres servis par le serveur, états, contenus (contrôles statiques)', () => {
    test(`tableau de bord (${DASHBOARD_PAGE}) : aucun chiffre calculé ni zéro affiché sans donnée ; essai et première utilisation servis`, () => {
        const files = screenFiles(DASHBOARD_PAGE);
        assert.deepEqual(figuresOfScreen(DASHBOARD_PAGE), [], 'chiffres calculés dans le navigateur');
        const strings = files.flatMap(stringsOf);
        const zeros = strings.filter((s) => /^0\s*(F|FCFA|F CFA|vendus?)$/i.test(s.trim()));
        assert.deepEqual(zeros, [], 'zéro affiché sans donnée (« 0 FCFA », « 0 vendu ») : KpiCard loading puis ErrorState');
        const code = files.map(codeOf).join('\n');
        assert.ok(!/\bkpis\b[\w?.!]*\s*(\|\||\?\?)\s*0\b/.test(code), 'repli « || 0 » sur un indicateur : un échec s’afficherait comme un zéro');
        assert.ok(!strings.some((s) => /Commissions EV/i.test(s)), '« Commissions EV » affiché alors que commissionAmount est codé à 0 (partner-dashboard.service.ts:477,553)');
        assert.ok(/\bonboarding\b/.test(code), 'onboarding servi par /api/partner/dashboard non lu');
        assert.ok(/\bends_at\b/.test(code), 'fin d’essai (trial.ends_at) servie non lue');
    });

    test(`tableau de bord : useServerData, KpiCard loading, ErrorState, état vide, DataList, statuts traduits, bandeau REJETE, IconButton, dates par lib/format, FirstEventSteps, interrupteur des commandes`, () => {
        const files = screenFiles(DASHBOARD_PAGE);
        const code = files.map(codeOf).join('\n');
        assert.ok(importsFrom(files, 'useServerData', /components\/partner\/useServerData$/) && calls(files, 'useServerData'), 'données non lues par useServerData');
        const kpis = assertRenders(files, 'KpiCard', 'components/ui/KpiCard.tsx', DASHBOARD_PAGE);
        assert.ok(kpis.some((u) => u.attrs.has('loading')), 'KpiCard sans état loading');
        assertErrorAndEmpty(files, DASHBOARD_PAGE);
        assertRenders(files, 'DataList', 'components/ui/DataList.tsx', DASHBOARD_PAGE);
        assert.deepEqual(intrinsicTags(files, 'table'), [], '<table> hors DataList');
        assert.deepEqual(rawValues(files, /^(status|order_status|delivery_mode)$/), [], 'statut ou mode affiché brut (enum)');
        assert.ok(files.flatMap(stringsOf).includes('REJETE'), 'aucun bandeau pour un partenaire REJETE');
        assert.ok(/reject\w*reason|rejection_reason/i.test(code), 'motif du refus non affiché dans le bandeau REJETE');
        const icons = assertRenders(files, 'IconButton', 'components/ui/IconButton.tsx', DASHBOARD_PAGE);
        assert.ok(icons.every((u) => u.attrs.has('aria-label')), 'IconButton sans aria-label');
        assert.ok(!/\.toLocale(Date|Time)?String\s*\(/.test(code), 'date ou montant formaté par toLocale*String (fuseau et format de lib/format)');
        assert.ok(importsFrom(files, 'formatDateTime', /lib\/format$/), 'formatDateTime de lib/format non utilisé');
        assert.ok(rendered(files, 'FirstEventSteps', [FIRST_STEPS]).length > 0, `${FIRST_STEPS} non rendu par le tableau de bord (première utilisation)`);
        assert.ok(importsFrom(files, 'useFeatureFlags', /lib\/features\/client$/) && calls(files, 'useFeatureFlags'), 'bloc « Commandes » non masqué par features.orders_enabled (useFeatureFlags, D69)');
    });

    test('tableau de bord : usePartnerOrders toujours importé (SCENARIO 15, tests/e2e-scenarios.test.ts:119-126) — garde-fou', () => {
        assert.ok(bindingsOf(DASHBOARD_PAGE).some((b) => b.imported === 'usePartnerOrders' && /hooks\/usePartnerOrders$/.test(b.spec)), 'usePartnerOrders n’est plus importé par le tableau de bord (D69 : bloc masqué, import gardé)');
    });

    test(`finances (${FINANCE_PAGE}) : statuts et attente servis, aucun calcul à l’horloge du téléphone, « 50 dernières écritures », formatFcfa de lib/format`, () => {
        const files = screenFiles(FINANCE_PAGE);
        assert.deepEqual(figuresOfScreen(FINANCE_PAGE), [], 'chiffres calculés dans le navigateur');
        const code = files.map(codeOf).join('\n');
        assert.ok(!/\bDate\.now\s*\(/.test(code), 'état décidé à l’horloge du téléphone (isFuture, finance:231-235) : is_pending est servi');
        assert.ok(/\bis_pending\b|\bisPending\b/.test(code), 'is_pending servi non lu');
        assert.ok(/\beffective_status\b|\beffectiveStatus\b/.test(code), 'effective_status servi non lu');
        assert.ok(files.flatMap(stringsOf).some((s) => /50 dernières écritures/.test(s)), '« 50 dernières écritures » non affiché (historique limité à 50 par le serveur, ledger.ts:48-55)');
        assert.ok(importsFrom(files, 'formatFcfa', /lib\/format$/), 'formatFcfa non importé de lib/format');
        assert.ok(!importsFrom(files, 'formatFcfa', /PaymentModal$/), 'formatFcfa importé de components/payment/PaymentModal');
    });

    test('finances : ErrorState, état vide, OtpInput, dates par lib/format', () => {
        const files = screenFiles(FINANCE_PAGE);
        assertErrorAndEmpty(files, FINANCE_PAGE);
        assertRenders(files, 'OtpInput', 'components/auth/OtpInput.tsx', `${FINANCE_PAGE} (code de confirmation du retrait)`);
        assert.ok(!/\.toLocale(Date|Time)?String\s*\(/.test(files.map(codeOf).join('\n')), 'date formatée par toLocale*String au lieu de lib/format');
    });

    test('finances : aucun taux codé en dur (tests/parcours/finance-moteur.test.ts:273) — garde-fou', () => {
        assert.ok(!/\*\s*0\.01\b|1\.5\s*%/.test(codeOf(FINANCE_PAGE)), 'taux de frais codé dans la page');
    });

    test(`équipe (${TEAM_PAGE}) : comptages et événements assignables servis, aucune éligibilité décidée dans le navigateur`, () => {
        const files = screenFiles(TEAM_PAGE);
        assert.deepEqual(figuresOfScreen(TEAM_PAGE), [], 'chiffres calculés dans le navigateur');
        const code = files.map(codeOf).join('\n');
        for (const field of ['members_count', 'assignments_count', 'assignable_events']) assert.ok(new RegExp(`\\b${field}\\b`).test(code), `${field} servi par /api/partner/team/all non lu`);
        assert.ok(!files.some((f) => bindingsOf(f).some((b) => b.imported === 'isEventEligibleForController')), 'éligibilité des événements décidée dans le navigateur (isEventEligibleForController)');
    });

    test('équipe : Modal, DataList, useServerData, ErrorState, état vide, LiveIndicator, statuts traduits', () => {
        const files = screenFiles(TEAM_PAGE);
        assert.ok(!files.flatMap(stringsOf).some((s) => /\bfixed\s+inset-0\b/.test(s)), 'modale écrite à la main (fixed inset-0) au lieu de Modal');
        assertRenders(files, 'Modal', 'components/ui/Modal.tsx', TEAM_PAGE);
        assertRenders(files, 'DataList', 'components/ui/DataList.tsx', TEAM_PAGE);
        assert.deepEqual(intrinsicTags(files, 'table'), [], '<table> hors DataList');
        assert.ok(importsFrom(files, 'useServerData', /components\/partner\/useServerData$/) && calls(files, 'useServerData'), 'données non lues par useServerData');
        assertErrorAndEmpty(files, TEAM_PAGE);
        assertRenders(files, 'LiveIndicator', 'components/ui/LiveIndicator.tsx', TEAM_PAGE);
        assert.deepEqual(rawValues(files, /^status$/), [], 'statut affiché brut (enum)');
    });

    test(`abonnement (${SUBSCRIPTION_PAGE}) : pourcentage d’essai servi, aucune durée recalculée`, () => {
        const files = screenFiles(SUBSCRIPTION_PAGE);
        assert.deepEqual(figuresOfScreen(SUBSCRIPTION_PAGE), [], 'chiffres calculés dans le navigateur');
        assert.ok(/\btrial_percent_used\b/.test(files.map(codeOf).join('\n')), 'trial_percent_used servi par /api/partner/subscription non lu');
    });

    test('abonnement : offres servies (pas de PLAN_HIGHLIGHTS), période traduite, état vide « Aucune offre n’est encore publiée », ErrorState', () => {
        const files = screenFiles(SUBSCRIPTION_PAGE);
        assert.ok(!/\bPLAN_HIGHLIGHTS\b/.test(files.map(codeOf).join('\n')), 'caractéristiques inventées (PLAN_HIGHLIGHTS, subscription:38-62)');
        assert.deepEqual(rawValues(files, /^billing_period$/), [], 'période de facturation affichée brute (« MONTHLY »)');
        assert.ok(files.flatMap(stringsOf).some((s) => /Aucune offre n(?:'|’|&apos;|&rsquo;)est encore publiée/.test(s)), 'état vide « Aucune offre n’est encore publiée » absent (D65)');
        const err = assertRenders(files, 'ErrorState', 'components/ui/EmptyState.tsx', SUBSCRIPTION_PAGE);
        assert.ok(err.some((u) => u.attrs.has('onRetry')), 'ErrorState sans onRetry');
    });

    test(`première utilisation (${FIRST_STEPS}) : étapes et liens servis, aucun calcul`, () => {
        assert.ok(isFile(FIRST_STEPS), `${FIRST_STEPS} absent (nouveau composant du contrat, section 12)`);
        assert.deepEqual(browserFigures(FIRST_STEPS), [], 'chiffres calculés dans le navigateur');
        const code = codeOf(FIRST_STEPS);
        assert.ok(/\bdone\b/.test(code), 'état coché (done) servi non lu');
        assert.ok(/\bhref\s*=\s*\{/.test(code), 'lien de chaque étape (href servi) non rendu');
        const links = rendered([FIRST_STEPS], 'LinkButton', ['components/ui/LinkButton.tsx']).length;
        assert.ok(links > 0 || /<Link\b/.test(code), 'aucun lien vers l’étape (LinkButton ou Link)');
    });
});
