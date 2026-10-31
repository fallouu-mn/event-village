/**
 * SEED DE TEST — idempotent, données fictives uniquement, instance Supabase locale.
 *
 *   npm run seed:test
 *
 * Crée ou met à jour :
 *  - un compte par rôle (CLIENT, CLIENT_BIS, PARTENAIRE A et B validés, CONTROLEUR affecté
 *    à l'événement publié de A, ADMIN, SUPERADMIN), mot de passe commun TEST_PASSWORD ;
 *  - platform_settings complets (dont ticketing_fee_config) ;
 *  - partenaire A : un événement PUBLIE (Standard 5 000 F × 10, VIP 15 000 F × 3),
 *    un BROUILLON, un événement passé ; partenaire B : un événement PUBLIE et un événement
 *    ANNULE avec sa fiche d'annulation ;
 *  - un compte client SUSPENDU ; un billet de référence sur l'événement de A et un sur celui de B.
 *
 * Les tests résolvent les UUID via tests/helpers/fixtures.ts, jamais en dur.
 */
import '../helpers/env';
import { randomBytes } from 'node:crypto';
import { getServiceRoleClient } from '../../lib/supabase/server';
import {
    CONTROLLER_A_EVENT,
    FIXTURE_CANCELLATIONS,
    FIXTURE_EVENTS,
    FIXTURE_PARTNERS,
    FIXTURE_TICKETS,
    FIXTURE_USERS,
    TEST_PASSWORD,
    fixtureUserStatus,
    type FixtureEventKey,
    type FixturePartnerKey,
    type FixtureUserKey,
} from '../helpers/fixtures';

if (process.env.EV_TEST_GUARD !== '1') {
    throw new Error('seed-test : garde-fou de test non chargé (tests/helpers/env.ts).');
}

const supabase = getServiceRoleClient();

type Summary = Record<string, unknown>;
const summary: Summary = {};

function isoDate(daysFromNow: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + daysFromNow);
    return d.toISOString().slice(0, 10);
}

function fail(step: string, error: { message: string; code?: string; details?: string | null; hint?: string | null } | null | undefined): never {
    const parts = [error?.message || 'erreur inconnue'];
    if (error?.code) parts.push(`code=${error.code}`);
    if (error?.details) parts.push(`details=${error.details}`);
    if (error?.hint) parts.push(`hint=${error.hint}`);
    throw new Error(`[seed-test] ${step} : ${parts.join(' | ')}`);
}

function logStep(message: string): void {
    console.log(`[seed-test] ${message}`);
}

// ── 1. platform_settings ─────────────────────────────────────────────────────
async function ensurePlatformSettings(): Promise<void> {
    const rows = [
        { key: 'ticketing_fee_config', value: { service_fee_rate: 5.0, aggregator_fee_rate: 1.5, description: 'Frais de service billetterie (acheteur) et frais agrégateur SamirPay' }, description: 'Seed de test' },
        { key: 'order_commission_config', value: { commission_rate: 5.0, description: 'Commission EV sur commandes restauration/services (%)' }, description: 'Seed de test' },
        { key: 'hall_fee_config', value: { aggregator_fee_rate: 1.5, description: 'Frais agrégateur SamirPay sur acomptes salles de fête (%)' }, description: 'Seed de test' },
        { key: 'withdrawal_fee_config', value: { fee_rate: 1.0, min_threshold: 5000, description: 'Frais de retrait (%) et seuil minimum (FCFA)' }, description: 'Seed de test' },
    ];
    const { error } = await supabase.from('platform_settings').upsert(rows, { onConflict: 'key' });
    if (error) fail('platform_settings', error);
    summary.platform_settings = rows.map((r) => r.key);
}

// ── 2. Utilisateurs (auth + public.users + user_roles) ───────────────────────
async function findAuthUserIdByEmail(email: string): Promise<string | null> {
    let page = 1;
    for (;;) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        if (error) fail(`auth.listUsers(page ${page})`, error);
        const hit = data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
        if (hit) return hit.id;
        if (data.users.length < 200) return null;
        page += 1;
    }
}

async function ensureUser(key: FixtureUserKey): Promise<string> {
    const spec = FIXTURE_USERS[key];
    const metadata = {
        first_name: spec.firstName,
        last_name: spec.lastName,
        phone: spec.phone,
        role: spec.primaryRole,
        roles: [...spec.roles],
        is_test_fixture: true,
    };

    let userId = await findAuthUserIdByEmail(spec.email);
    if (!userId) {
        const { data, error } = await supabase.auth.admin.createUser({
            email: spec.email,
            password: TEST_PASSWORD,
            email_confirm: true,
            phone: spec.phone,
            phone_confirm: true,
            user_metadata: metadata,
        });
        if (error || !data.user) fail(`auth.createUser(${key})`, error);
        userId = data.user.id;
    } else {
        const { error } = await supabase.auth.admin.updateUserById(userId, {
            password: TEST_PASSWORD,
            email_confirm: true,
            phone: spec.phone,
            phone_confirm: true,
            user_metadata: metadata,
        });
        if (error) fail(`auth.updateUserById(${key})`, error);
    }

    const { error: profileErr } = await supabase.from('users').upsert(
        {
            id: userId,
            first_name: spec.firstName,
            last_name: spec.lastName,
            phone: spec.phone,
            email: spec.email,
            role: spec.primaryRole,
            status: fixtureUserStatus(key),
            referral_status: 'STANDARD',
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
    );
    if (profileErr) fail(`users.upsert(${key})`, profileErr);

    const { error: rolesErr } = await supabase
        .from('user_roles')
        .upsert(spec.roles.map((role) => ({ user_id: userId, role })), { onConflict: 'user_id,role' });
    if (rolesErr) fail(`user_roles.upsert(${key})`, rolesErr);

    const { error: pruneErr } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .not('role', 'in', `(${spec.roles.join(',')})`);
    if (pruneErr) fail(`user_roles.prune(${key})`, pruneErr);

    return userId;
}

// ── 3. Partenaires ───────────────────────────────────────────────────────────
async function ensurePartner(key: FixturePartnerKey, userId: string): Promise<string> {
    const spec = FIXTURE_PARTNERS[key];
    const { data: plan, error: planErr } = await supabase.from('subscription_plans').select('id').eq('code', 'STARTER').maybeSingle();
    if (planErr) fail('subscription_plans.STARTER', planErr);

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 60 * 24 * 3600 * 1000);
    const base = {
        user_id: userId,
        company_name: spec.companyName,
        commercial_name: spec.commercialName,
        description: `Partenaire de test ${key} — données fictives`,
        address: `${key} rue de Test`,
        city: spec.city,
        phone: FIXTURE_USERS[spec.userKey].phone,
        email: FIXTURE_USERS[spec.userKey].email,
        is_verified: true,
        status: 'VALIDE',
        subscription_plan_id: plan?.id ?? null,
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnd.toISOString(),
        updated_at: now.toISOString(),
    };

    const { data: existing, error: findErr } = await supabase.from('partners').select('id').eq('user_id', userId).maybeSingle();
    if (findErr) fail(`partners.find(${key})`, findErr);

    let partnerId: string;
    if (existing) {
        const { error } = await supabase.from('partners').update(base).eq('id', existing.id);
        if (error) fail(`partners.update(${key})`, error);
        partnerId = existing.id;
    } else {
        const { data, error } = await supabase.from('partners').insert(base).select('id').single();
        if (error || !data) fail(`partners.insert(${key})`, error);
        partnerId = data.id;
    }

    const { error: actErr } = await supabase
        .from('partner_activities')
        .upsert({ partner_id: partnerId, activity_type: 'ORGANISATEUR', is_active: true }, { onConflict: 'partner_id,activity_type' });
    if (actErr) fail(`partner_activities(${key})`, actErr);

    return partnerId;
}

// ── 4. Événements et catégories ──────────────────────────────────────────────
async function ensureEvent(key: FixtureEventKey, partnerId: string): Promise<{ id: string; categories: Record<string, string> }> {
    const spec = FIXTURE_EVENTS[key];
    const date = isoDate(spec.daysFromNow);
    const capacity = spec.categories.reduce((s, c) => s + c.total, 0) + 10;

    const row = {
        partner_id: partnerId,
        title: spec.title,
        slug: spec.slug,
        description: `Événement de test ${key} — données fictives, aucune vente réelle.`,
        start_date: date,
        start_time: '20:00:00',
        end_date: date,
        end_time: '23:30:00',
        location: 'Salle de test, Dakar',
        city: 'Dakar',
        latitude: 14.6937,
        longitude: -17.4441,
        capacity,
        status: spec.status,
        category: 'CONCERT',
        program: [
            { time: '20:00', title: 'Ouverture des portes' },
            { time: '21:00', title: 'Artiste de test' },
        ],
        practical_info: { address: 'Salle de test, Dakar', access: 'Bus ligne test', parking: 'Parking de test', contact: '+221700000000', rules: 'Pièce d\'identité requise' },
        services: { ticketing: true, tables: false, communication: false, promotion: false },
        updated_at: new Date().toISOString(),
    };

    const { data: event, error } = await supabase.from('events').upsert(row, { onConflict: 'slug' }).select('id').single();
    if (error || !event) fail(`events.upsert(${key})`, error);

    const { data: existingCats, error: catErr } = await supabase.from('ticket_categories').select('id, name').eq('event_id', event.id);
    if (catErr) fail(`ticket_categories.list(${key})`, catErr);

    const categories: Record<string, string> = {};
    for (const c of spec.categories) {
        const existing = (existingCats || []).find((x) => x.name === c.name);
        if (existing) {
            const { error: upErr } = await supabase
                .from('ticket_categories')
                .update({ price: c.price, total_quantity: c.total, is_active: true, is_visible: true, max_per_order: 10, updated_at: new Date().toISOString() })
                .eq('id', existing.id);
            if (upErr) fail(`ticket_categories.update(${key}/${c.name})`, upErr);
            categories[c.name] = existing.id;
        } else {
            const { data: created, error: insErr } = await supabase
                .from('ticket_categories')
                .insert({
                    event_id: event.id,
                    name: c.name,
                    description: `Catégorie ${c.name} (test)`,
                    price: c.price,
                    total_quantity: c.total,
                    sold_quantity: 0,
                    is_active: true,
                    is_visible: true,
                    max_per_order: 10,
                })
                .select('id')
                .single();
            if (insErr || !created) fail(`ticket_categories.insert(${key}/${c.name})`, insErr);
            categories[c.name] = created.id;
        }
    }

    return { id: event.id, categories };
}

// ── 5. Affectation contrôleur ────────────────────────────────────────────────
// ── 4 bis. Billet de référence et compteurs de stock cohérents ──────────────
async function ensureFixtureTicket(
    key: keyof typeof FIXTURE_TICKETS,
    eventId: string,
    categoryId: string,
    ownerId: string
): Promise<string> {
    const spec = FIXTURE_TICKETS[key];
    const { data: category, error: catErr } = await supabase.from('ticket_categories').select('price').eq('id', categoryId).single();
    if (catErr || !category) fail(`ticket_categories.price(${key})`, catErr);

    const { data: existing, error: findErr } = await supabase.from('tickets').select('id').eq('ticket_number', spec.ticketNumber).maybeSingle();
    if (findErr) fail(`tickets.find(${key})`, findErr);

    const row = {
        event_id: eventId,
        category_id: categoryId,
        user_id: ownerId,
        ticket_number: spec.ticketNumber,
        qr_code: spec.qrCode,
        price: category.price,
        status: 'VALIDE',
        checked_in_at: null,
        checked_in_by: null,
        updated_at: new Date().toISOString(),
    };

    if (existing) {
        const { error } = await supabase.from('tickets').update(row).eq('id', existing.id);
        if (error) fail(`tickets.update(${key})`, error);
        return existing.id;
    }
    const { data: created, error } = await supabase
        .from('tickets')
        .insert({ ...row, totp_secret: randomBytes(32).toString('hex') })
        .select('id')
        .single();
    if (error || !created) fail(`tickets.insert(${key})`, error);
    return created.id;
}

/** sold_quantity = billets VALIDE/UTILISE réellement émis, held_quantity = 0 (base de référence des tests). */
async function syncCategoryCounters(categoryId: string): Promise<void> {
    const { count, error } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', categoryId)
        .in('status', ['VALIDE', 'UTILISE']);
    if (error) fail('tickets.count', error);
    const { error: upErr } = await supabase
        .from('ticket_categories')
        .update({ sold_quantity: count ?? 0, held_quantity: 0, updated_at: new Date().toISOString() })
        .eq('id', categoryId);
    if (upErr) fail('ticket_categories.counters', upErr);
}

async function ensureCancellation(key: keyof typeof FIXTURE_CANCELLATIONS, eventId: string, cancelledBy: string): Promise<string> {
    const spec = FIXTURE_CANCELLATIONS[key];
    const { data: existing, error: findErr } = await supabase.from('event_cancellations').select('id').eq('event_id', eventId).maybeSingle();
    if (findErr) fail(`event_cancellations.find(${key})`, findErr);
    const row = {
        event_id: eventId,
        cancelled_by: cancelledBy,
        internal_reason: spec.internalReason,
        public_notice: spec.publicNotice,
        updated_at: new Date().toISOString(),
    };
    if (existing) {
        const { error } = await supabase.from('event_cancellations').update(row).eq('id', existing.id);
        if (error) fail(`event_cancellations.update(${key})`, error);
        return existing.id;
    }
    const { data: created, error } = await supabase.from('event_cancellations').insert(row).select('id').single();
    if (error || !created) fail(`event_cancellations.insert(${key})`, error);
    return created.id;
}

async function ensureControllerAssignment(eventId: string, controllerUserId: string, createdBy: string): Promise<void> {
    const { error } = await supabase
        .from('event_controllers')
        .upsert({ event_id: eventId, user_id: controllerUserId, can_accept_cash: true, created_by: createdBy }, { onConflict: 'event_id,user_id' });
    if (error) fail('event_controllers.upsert', error);
}

// ── Exécution ────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
    const started = Date.now();
    console.log(`[seed-test] Instance : ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);

    logStep('platform_settings…');
    await ensurePlatformSettings();

    const userIds = {} as Record<FixtureUserKey, string>;
    for (const key of Object.keys(FIXTURE_USERS) as FixtureUserKey[]) {
        logStep(`utilisateur ${key}…`);
        userIds[key] = await ensureUser(key);
    }
    summary.users = userIds;

    const partnerIds = {} as Record<FixturePartnerKey, string>;
    for (const key of Object.keys(FIXTURE_PARTNERS) as FixturePartnerKey[]) {
        logStep(`partenaire ${key}…`);
        partnerIds[key] = await ensurePartner(key, userIds[FIXTURE_PARTNERS[key].userKey]);
    }
    summary.partners = partnerIds;

    const eventIds: Record<string, { id: string; categories: Record<string, string> }> = {};
    for (const key of Object.keys(FIXTURE_EVENTS) as FixtureEventKey[]) {
        logStep(`événement ${key}…`);
        eventIds[key] = await ensureEvent(key, partnerIds[FIXTURE_EVENTS[key].partner]);
    }
    summary.events = eventIds;

    logStep('affectation contrôleur…');
    await ensureControllerAssignment(eventIds[CONTROLLER_A_EVENT].id, userIds.CONTROLLER_A, userIds.PARTNER_A);
    summary.controller_assignment = { event: CONTROLLER_A_EVENT, controller: 'CONTROLLER_A', can_accept_cash: true };

    const tickets: Record<string, string> = {};
    for (const key of Object.keys(FIXTURE_TICKETS) as (keyof typeof FIXTURE_TICKETS)[]) {
        const spec = FIXTURE_TICKETS[key];
        logStep(`billet ${key}…`);
        tickets[key] = await ensureFixtureTicket(key, eventIds[spec.event].id, eventIds[spec.event].categories[spec.category], userIds[spec.owner]);
    }
    summary.tickets = tickets;

    const cancellations: Record<string, string> = {};
    for (const key of Object.keys(FIXTURE_CANCELLATIONS) as (keyof typeof FIXTURE_CANCELLATIONS)[]) {
        const spec = FIXTURE_CANCELLATIONS[key];
        logStep(`annulation ${key}…`);
        cancellations[key] = await ensureCancellation(key, eventIds[spec.event].id, userIds[spec.cancelledBy]);
    }
    summary.cancellations = cancellations;

    logStep('compteurs de stock des catégories…');
    for (const key of Object.keys(eventIds)) {
        for (const categoryId of Object.values(eventIds[key].categories)) {
            await syncCategoryCounters(categoryId);
        }
    }

    console.log(JSON.stringify(summary, null, 2));
    console.log(`[seed-test] OK en ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
