/**
 * Lot 9 bis, tâche 16 (R7 et ex-10.0 b ; contrat 5.16, B39, 4.2) — partenaire EN_ATTENTE : elle voit son tableau de
 * bord (« Compte en cours de vérification »), son profil et ses documents ; toute création ou publication est refusée
 * côté serveur (403 PARTNER_NOT_VALIDATED).
 *  - VRAI compte en attente : inscription par la route en deux appels (registerPartnerTwoStep, code lu dans le faux SMS),
 *    puis connexion par mot de passe (clé anon) ;
 *  - GET /api/partner/dashboard → 200, `partner.status = 'EN_ATTENTE'` ; GET /api/partner/profile → 200 ;
 *  - POST /api/partner/events → 403 PARTNER_NOT_VALIDATED « Votre profil d’organisateur doit être validé avant de créer un
 *    événement. », aucun événement ;
 *  - partenaire VALIDE dont la fiche est remise EN_ATTENTE en base : soumission (BROUILLON → EN_ATTENTE) et publication
 *    (VALIDE → PUBLIE) → 403 PARTNER_NOT_VALIDATED, statut inchangé.
 * Le compte est retrouvé par son numéro : il existe après l'appel 1 aujourd'hui, après l'appel 2 une fois R53 corrigé ;
 * cette suite ne juge donc pas l'inscription (tâche 17), seulement l'accès du compte en attente.
 *
 * Rouge avant correctif (fix(9b.16), fix(9b.16-SC)) : dashboard et profile exigent un compte ACTIF (403
 * ACCOUNT_NOT_ACTIVE, app/api/partner/dashboard/route.ts:15, profile/route.ts:114) ; la création répond
 * ACCOUNT_NOT_ACTIVE ; event_transition ne lit jamais partners.status (M/20261103000005:942-1054) : 200.
 * Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { randomEmail, randomSenegalPhone, registerPartnerTwoStep, STRONG_PASSWORD, uploadRegistrationDocuments } from './helpers';
import { service } from './paiement-helpers';
import { jsonRequest, newPartner } from './finance-helpers';
import type { RouteResult } from './acces-helpers';
import { createEventInStatus, eventStatus, posterUrl } from './cycle-helpers';
import { dakarDay } from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { gotrueEmail } from '../helpers/gotrue-email';

after(async () => {
    await assertLot9bisInvariants('partenaire-en-attente');
});

type Row = Record<string, unknown>;

const CREATE_TEXT = 'Votre profil d’organisateur doit être validé avant de créer un événement.';
const PUBLISH_TEXT = 'Votre profil d’organisateur doit être validé avant de soumettre ou de publier un événement.';

interface PendingPartner { userId: string; partnerId: string; token: string }

let pending: PendingPartner;

function sameQuotes(v: unknown): string {
    return String(v ?? '').replace(/’/g, '\'');
}

function ctx(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

/** Inscription réelle en deux appels, puis connexion avec le mot de passe choisi (adresse de connexion lue dans GoTrue). */
async function registerPending(): Promise<PendingPartner> {
    const phone = randomSenegalPhone('77');
    const reg = await registerPartnerTwoStep({
        companyName: `Attente ${randomUUID().slice(0, 6)} SARL`,
        description: 'Organisateur fictif en cours de vérification (lot 9 bis, R7).',
        address: '9 rue de l’Attente',
        city: 'Dakar',
        activities: ['ORGANISATEUR'],
        firstName: 'Coumba',
        lastName: 'Attente',
        phone,
        email: randomEmail('r7-attente'),
        password: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
        ...(await uploadRegistrationDocuments()),
    });
    assert.equal(reg.first.status, 200, `inscription, appel 1 : HTTP ${reg.first.status} ${JSON.stringify(reg.first.body)}`);
    const { data: user, error } = await service.from('users').select('id, status').in('phone', [phone, phone.replace(/^\+/, '')]).maybeSingle();
    assert.equal(error, null, error?.message);
    assert.ok(user, `compte de la partenaire introuvable après l’inscription (appel 2 : ${JSON.stringify(reg.second)})`);
    const { data: partner, error: pErr } = await service.from('partners').select('id, status').eq('user_id', user.id).single();
    assert.equal(pErr, null, pErr?.message);
    assert.equal(partner.status, 'EN_ATTENTE', 'précondition : dossier EN_ATTENTE');
    assert.equal(user.status, 'EN_ATTENTE', 'précondition : compte EN_ATTENTE (partner_register_finalize)');
    const { data: auth, error: aErr } = await service.auth.admin.getUserById(String(user.id));
    assert.equal(aErr, null, aErr?.message);
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: session, error: sErr } = await anon.auth.signInWithPassword({ email: await gotrueEmail(String(auth.user?.email)), password: STRONG_PASSWORD });
    assert.equal(sErr, null, `connexion du compte en attente : ${sErr?.message}`);
    return { userId: String(user.id), partnerId: String(partner.id), token: session.session!.access_token };
}

async function get(mod: string, path: string, token: string): Promise<RouteResult> {
    return invoke(await routeHandler(`../../app/api/partner/${mod}/route`, 'GET', `GET ${path}`), jsonRequest(path, 'GET', token));
}

before(async () => {
    pending = await registerPending();
});

describe('R7 — compte partenaire EN_ATTENTE : lecture ouverte', () => {
    test('GET /api/partner/dashboard → 200 et partner.status = EN_ATTENTE (bandeau « Compte en cours de vérification »)', async () => {
        const res = await get('dashboard', '/api/partner/dashboard', pending.token);
        assert.equal(res.status, 200, `R7 : tableau de bord d’un compte en attente : ${show(res)}`);
        assert.equal((res.body.partner as Row | undefined)?.status, 'EN_ATTENTE', `statut servi : ${show(res)}`);
    });

    test('GET /api/partner/profile → 200', async () => {
        const res = await get('profile', '/api/partner/profile', pending.token);
        assert.equal(res.status, 200, `R7 : profil d’un compte en attente : ${show(res)}`);
    });
});

describe('R7 — création et publication refusées côté serveur', () => {
    test('POST /api/partner/events → 403 PARTNER_NOT_VALIDATED, aucun événement créé', async () => {
        const day = dakarDay(10);
        const title = `TEST Attente ${Date.now()}`;
        const res = await invoke(await routeHandler('../../app/api/partner/events/route', 'POST', 'POST /api/partner/events'),
            jsonRequest('/api/partner/events', 'POST', pending.token, {
                title, category: 'CONCERT', description: 'Concert refusé : organisateur en attente (lot 9 bis).',
                start_date: day, start_time: '20:00', end_date: day, end_time: '23:00',
                location: 'Grand Théâtre de Dakar', city: 'Dakar', image_url: posterUrl(pending.partnerId), capacity: 100,
                ticket_categories: [{ name: 'Standard', price: 5000, total_quantity: 50, max_per_order: 4, is_visible: true }],
            }));
        assert.equal(res.status, 403, `R7 : création par un compte en attente : ${show(res)}`);
        assert.equal(res.body.code, 'PARTNER_NOT_VALIDATED', `code : ${show(res)}`);
        assert.equal(sameQuotes(res.body.error), sameQuotes(CREATE_TEXT), `texte : ${show(res)}`);
        const { count, error } = await service.from('events').select('id', { count: 'exact', head: true }).eq('partner_id', pending.partnerId);
        assert.equal(error, null, error?.message);
        assert.equal(count ?? 0, 0, 'aucun événement créé');
    });

    test('fiche remise EN_ATTENTE : soumission et publication par la propriétaire → 403 PARTNER_NOT_VALIDATED, statuts inchangés', async () => {
        const owner = await newPartner('r7-publie');
        const cats = [{ name: 'Standard', price: 5_000, total: 20 }];
        const ready = await createEventInStatus(owner, 'r7-valide', cats, 'VALIDE', { startsInHours: 72 });
        const draft = await createEventInStatus(owner, 'r7-brouillon', cats, 'BROUILLON', { startsInHours: 72 });
        const { error } = await service.from('partners').update({ status: 'EN_ATTENTE', is_verified: false }).eq('id', owner.partnerId);
        assert.equal(error, null, `fiche remise EN_ATTENTE : ${error?.message}`);

        const transition = async (eventId: string, to: string): Promise<RouteResult> => invoke(
            await routeHandler('../../app/api/partner/events/[id]/transition/route', 'POST', 'POST /api/partner/events/[id]/transition'),
            jsonRequest(`/api/partner/events/${eventId}/transition`, 'POST', owner.accessToken, { to }), ctx({ id: eventId }));

        const publish = await transition(ready.eventId, 'PUBLIE');
        assert.equal(publish.status, 403, `R7 : publication par une partenaire non validée : ${show(publish)}`);
        assert.equal(publish.body.code, 'PARTNER_NOT_VALIDATED', show(publish));
        assert.equal(sameQuotes(publish.body.error), sameQuotes(PUBLISH_TEXT), show(publish));
        assert.equal(await eventStatus(ready.eventId), 'VALIDE', 'toujours VALIDE');

        const submit = await transition(draft.eventId, 'EN_ATTENTE');
        assert.equal(submit.status, 403, `R7 : soumission par une partenaire non validée : ${show(submit)}`);
        assert.equal(submit.body.code, 'PARTNER_NOT_VALIDATED', show(submit));
        assert.equal(await eventStatus(draft.eventId), 'BROUILLON', 'toujours BROUILLON');
    });
});
