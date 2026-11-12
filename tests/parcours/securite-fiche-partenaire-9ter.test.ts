/**
 * Lot 9 ter, tâche 9t.1 (consigne 0.1, arbitrages 1 à 4 ; contrat 5.A, A.1.5 suite 2, invariants x1 et x2) — une
 * partenaire, quel que soit l'état de sa fiche, ne la modifie que par les écrans : aucune écriture REST directe.
 *  1. EN_ATTENTE, REJETE, SUSPENDU et VALIDE (témoin) : PATCH REST de chaque colonne sensible de sa fiche → 42501
 *     strict ; fiche relue identique (JSON entier, updated_at compris) ; aucun journal ; aucun message de partenaire ;
 *     DELETE → 42501 et fiche présente ; POST d'une seconde fiche VALIDE → 42501, toujours une seule fiche ;
 *  2. REJETE : se valider par REST puis créer un événement est impossible (PATCH 42501, puis
 *     POST /api/partner/events → 403 PARTNER_NOT_VALIDATED) ;
 *  3. témoins verts dès l'écriture : PATCH /api/partner/profile d'une VALIDE → 200 ; validation d'une fiche EN_ATTENTE
 *     par un admin partners.validate (PATCH /api/admin/partners/[id]/status) → 200 et journal PARTNER_STATUS_SET.
 *
 * Acteur testé : client créé par la clé anon et connecté par mot de passe (nouvelle connexion après la mise en état,
 * précondition explicite qu'elle réussit) ; montage par le client serveur seulement. Une partenaire neuve par état,
 * SANS événement ni paiement : aucune trace de cascade (w7 tenu au run « avant »). Chaque cas s'arrête au premier
 * PATCH accepté : au run « avant », une seule colonne au plus est écrite sur une fiche de test.
 *
 * Rouge avant correctif (fix(9t.1), migration 20261110000001_lot9ter_rls) : partners_update_owner
 * (M/0003_rls.sql:115-116, sans WITH CHECK, aucun REVOKE sur partners) accepte le PATCH de status. Cas 3 : vert dès
 * l'écriture (témoins, annoncés).
 * Fin de suite : assertLot9terInvariants (rouge tant que le schéma du lot 9 ter n'est pas complet).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { dbClockMs } from '../helpers/quota-window';
import { STRONG_PASSWORD } from './helpers';
import { service } from './paiement-helpers';
import { jsonRequest, newPartner, superadminId, type TestPartner } from './finance-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { newAdminWith } from './terrain-helpers';

after(async () => {
    await assertLot9terInvariants('securite-fiche-partenaire-9ter');
});

type Row = Record<string, unknown>;
type FicheState = 'EN_ATTENTE' | 'REJETE' | 'SUSPENDU' | 'VALIDE';

const REJECT_REASON = 'Pièces illisibles (test du lot 9 ter)';
const SUSPEND_REASON = 'Suspension de test du lot 9 ter';
const VALIDATE_REASON = 'Dossier complet (test du lot 9 ter)';

interface SignedPartner extends TestPartner {
    client: SupabaseClient;
    token: string;
}

/** Nouvelle connexion par mot de passe avec la clé anon seule : précondition explicite qu'elle réussit. */
async function signIn(partner: TestPartner, state: FicheState): Promise<SignedPartner> {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await client.auth.signInWithPassword({ email: partner.email, password: STRONG_PASSWORD });
    assert.equal(error, null, `précondition : nouvelle connexion de la partenaire ${state} réussie : ${error?.message}`);
    assert.ok(data.session, `précondition : session ouverte pour la partenaire ${state}`);
    return { ...partner, client, token: data.session.access_token };
}

async function statusSet(partner: TestPartner, status: string, reason: string): Promise<void> {
    const { data, error } = await service.rpc('partner_status_set', { p: { partner_id: partner.partnerId, actor_id: await superadminId(), status, reason } });
    assert.equal(error, null, `partner_status_set ${status} : ${error?.message}`);
    assert.equal((data as Row | null)?.ok, true, `partner_status_set ${status} refusé : ${JSON.stringify(data)}`);
}

/** Dossier remis EN_ATTENTE en base (préparation, patron fiche-partenaire-9bis.test.ts). */
async function pending(label: string): Promise<TestPartner> {
    const p = await newPartner(label);
    const { error } = await service.from('partners').update({ status: 'EN_ATTENTE', is_verified: false }).eq('id', p.partnerId);
    assert.equal(error, null, `fiche EN_ATTENTE : ${error?.message}`);
    const { error: uErr } = await service.from('users').update({ status: 'EN_ATTENTE' }).eq('id', p.userId);
    assert.equal(uErr, null, `compte EN_ATTENTE : ${uErr?.message}`);
    return p;
}

/** Partenaire neuve dans l'état demandé (sans événement ni paiement), puis nouvelle connexion. */
async function partnerIn(state: FicheState, label: string): Promise<SignedPartner> {
    let p: TestPartner;
    if (state === 'EN_ATTENTE') {
        p = await pending(label);
    } else if (state === 'REJETE') {
        p = await pending(label);
        await statusSet(p, 'REJETE', REJECT_REASON);
    } else if (state === 'SUSPENDU') {
        p = await newPartner(label);
        await statusSet(p, 'SUSPENDU', SUSPEND_REASON);
    } else {
        p = await newPartner(label);
    }
    const { data, error } = await service.from('partners').select('status').eq('id', p.partnerId).single();
    assert.equal(error, null, error?.message);
    assert.equal(data.status, state, `précondition : fiche ${state}`);
    return signIn(p, state);
}

async function ficheRow(partnerId: string): Promise<Row> {
    const { data, error } = await service.from('partners').select('*').eq('id', partnerId).single();
    assert.equal(error, null, `relecture de la fiche : ${error?.message}`);
    return data as Row;
}

async function activePlanId(): Promise<string> {
    const { data, error } = await service.from('subscription_plans').select('id').eq('is_active', true).order('id').limit(1);
    assert.equal(error, null, `formule active : ${error?.message}`);
    assert.ok(data && data.length === 1, 'précondition : au moins une formule d’abonnement active');
    return String(data[0].id);
}

/** Colonnes sensibles de la fiche et valeurs écrites, dans l'ordre du contrat (A.1.5, suite 2, cas 1). */
async function sensitivePatches(p: SignedPartner, state: FicheState): Promise<Array<[string, unknown]>> {
    return [
        ['status', state === 'VALIDE' ? 'EN_ATTENTE' : 'VALIDE'],
        ['is_verified', true],
        ['resubmitted_at', null],
        ['resubmitted_at', new Date().toISOString()],
        ['rejection_reason', 'Effacé par la partenaire'],
        ['suspended_reason', null],
        ['subscription_plan_id', await activePlanId()],
        ['trial_started_at', new Date().toISOString()],
        ['trial_ends_at', '2099-12-31T00:00:00Z'],
        ['is_founder', true],
        ['phone_verified', true],
        ['user_id', p.userId],
        ['id_card_url', 'https://exemple.invalid/piece.pdf'],
        ['business_doc_url', 'https://exemple.invalid/piece.pdf'],
        ['ninea', '123456789'],
        ['rccm', 'SN-DKR-2026-B-00001'],
        ['created_at', '2020-01-01T00:00:00Z'],
        ['description', 'Description changée par REST'],
    ];
}

function assertDenied42501(error: { code?: string; message?: string } | null, what: string): void {
    assert.equal(error?.code, '42501', `${what} : refus 42501 attendu, obtenu ${error ? `code=${error.code} ${error.message}` : 'aucune erreur (écriture REST acceptée)'}`);
}

describe('9t.1 — fiche partenaire : aucune écriture REST, quel que soit son état', () => {
    for (const state of ['EN_ATTENTE', 'REJETE', 'SUSPENDU', 'VALIDE'] as const) {
        test(`${state} : un PATCH REST de chaque colonne sensible de sa fiche est refusé (42501), fiche identique, aucun journal ni message`, async () => {
            const p = await partnerIn(state, `9t1-${state.toLowerCase()}`);
            const before = await ficheRow(p.partnerId);
            const t0 = new Date(await dbClockMs()).toISOString();

            for (const [column, value] of await sensitivePatches(p, state)) {
                const { error } = await p.client.from('partners').update({ [column]: value }).eq('id', p.partnerId);
                assertDenied42501(error, `${state} : PATCH partners.${column} = ${JSON.stringify(value)}`);
            }
            assert.deepEqual(await ficheRow(p.partnerId), before, `${state} : la fiche a changé après les PATCH refusés`);

            const { count: audits, error: aErr } = await service.from('audit_logs').select('id', { count: 'exact', head: true })
                .eq('object_id', p.partnerId).gte('created_at', t0);
            assert.equal(aErr, null, aErr?.message);
            assert.equal(audits, 0, `${state} : aucun journal attendu sur la fiche depuis les tentatives`);
            const { data: notes, error: nErr } = await service.from('notification_outbox').select('type, created_at')
                .eq('recipient_user_id', p.userId).gte('created_at', t0)
                .or('type.like.PARTNER_*,type.in.(SUBSCRIPTION_ACTIVATED,TRIAL_STARTED)');
            assert.equal(nErr, null, nErr?.message);
            assert.deepEqual(notes ?? [], [], `${state} : aucun message de partenaire attendu depuis les tentatives`);

            const del = await p.client.from('partners').delete().eq('id', p.partnerId);
            assertDenied42501(del.error, `${state} : DELETE partners`);
            assert.deepEqual(await ficheRow(p.partnerId), before, `${state} : fiche toujours présente et identique après le DELETE refusé`);

            const ins = await p.client.from('partners').insert({ user_id: p.userId, company_name: `Seconde fiche ${state}`, status: 'VALIDE', is_verified: true });
            assertDenied42501(ins.error, `${state} : POST partners (seconde fiche VALIDE)`);
            const { count: fiches, error: fErr } = await service.from('partners').select('id', { count: 'exact', head: true }).eq('user_id', p.userId);
            assert.equal(fErr, null, fErr?.message);
            assert.equal(fiches, 1, `${state} : une seule fiche pour le compte`);
        });
    }

    test('REJETE : se valider par REST puis créer un événement est impossible', async () => {
        const p = await partnerIn('REJETE', '9t1-rejete-evenement');
        const { error } = await p.client.from('partners').update({ status: 'VALIDE' }).eq('id', p.partnerId);
        assertDenied42501(error, 'REJETE : PATCH partners.status = VALIDE');
        assert.equal((await ficheRow(p.partnerId)).status, 'REJETE', 'fiche toujours REJETE');

        const handler = await routeHandler('../../app/api/partner/events/route', 'POST', 'POST /api/partner/events');
        const res = await invoke(handler, jsonRequest('/api/partner/events', 'POST', p.token, {}));
        assert.equal(res.status, 403, `création d’événement d’une partenaire refusée : ${show(res)}`);
        assert.equal(res.body.code, 'PARTNER_NOT_VALIDATED', show(res));
    });
});

describe('9t.1 — témoins : les écrans gardent leurs écritures (verts dès l’écriture)', () => {
    function ctx(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
        return { params: Object.assign(Promise.resolve(params), params) };
    }

    test('PATCH /api/partner/profile d’une partenaire VALIDE → 200, nom changé', async () => {
        const p = await partnerIn('VALIDE', '9t1-profil');
        const name = `Structure témoin ${p.partnerId.slice(0, 8)}`;
        const handler = await routeHandler('../../app/api/partner/profile/route', 'PATCH', 'PATCH /api/partner/profile');
        const res = await invoke(handler, jsonRequest('/api/partner/profile', 'PATCH', p.token, { company_name: name }));
        assert.equal(res.status, 200, `modification du profil par l’écran : ${show(res)}`);
        assert.equal((await ficheRow(p.partnerId)).company_name, name, 'nom de la structure changé par la route');
    });

    test('validation d’une fiche EN_ATTENTE par un admin partners.validate → 200 et journal PARTNER_STATUS_SET', async () => {
        const p = await pending('9t1-validation');
        const admin = await newAdminWith(['partners.validate'], { label: '9t1-validation' });
        const handler = await routeHandler('../../app/api/admin/partners/[id]/status/route', 'PATCH', 'PATCH /api/admin/partners/[id]/status');
        const res = await invoke(handler, jsonRequest(`/api/admin/partners/${p.partnerId}/status`, 'PATCH', admin.accessToken,
            { status: 'VALIDE', reason: VALIDATE_REASON }), ctx({ id: p.partnerId }));
        assert.equal(res.status, 200, `validation par l’admin : ${show(res)}`);
        assert.equal((await ficheRow(p.partnerId)).status, 'VALIDE', 'fiche VALIDE');
        const { data: audit, error } = await service.from('audit_logs').select('action, user_id')
            .eq('object_id', p.partnerId).eq('action', 'PARTNER_STATUS_SET');
        assert.equal(error, null, error?.message);
        assert.ok((audit ?? []).some((a) => a.user_id === admin.userId), `journal PARTNER_STATUS_SET de l’admin attendu : ${JSON.stringify(audit)}`);
    });
});
