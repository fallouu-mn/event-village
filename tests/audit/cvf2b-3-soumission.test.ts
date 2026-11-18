/**
 * Contre-vérification de la finition 2b, attaque 3 — soumission d'un événement à la validation depuis le formulaire
 * (« Vérifier avant d'envoyer » puis « Envoyer pour validation » : POST /api/partner/events/[id]/transition { to:
 * 'EN_ATTENTE' }). Règle : un événement n'arrive EN_ATTENTE que complet (affiche, repère sur la carte, au moins une
 * catégorie active, début dans le futur, périodes de vente avant la fin) ; un refus ne change rien.
 *  a. Route, un manque à la fois (et tous ensemble) : refus 422, l'événement reste BROUILLON, rien d'écrit (ligne,
 *     catégories, historique des statuts, boîte d'envoi). Témoin : un brouillon complet passe.
 *  b. Parcours du formulaire : création par la route, puis manque ajouté par les routes de modification (affiche retirée,
 *     repère retiré, seule catégorie désactivée puis supprimée), dates absentes ou incohérentes ; chaque envoi est refusé.
 *  c. Création directe « déjà soumise » : statut ou drapeau d'envoi dans le corps de POST /api/partner/events.
 *  d. REST et RPC directes avec la session de l'organisatrice (puis sans session) : statut écrit dans `events`, ligne
 *     d'historique, catégorie ajoutée, event_transition, event_status_apply, event_update, event_update_preview,
 *     event_create.
 *  e. Événement d'une autre organisatrice : soumission, retrait, publication, modification, catégorie, RPC au nom de
 *     la propriétaire.
 *  f. Courses : retrait d'un manque (affiche, repère, catégorie désactivée ou supprimée) envoyé en même temps que la
 *     soumission (Promise.all, plusieurs tours) : jamais EN_ATTENTE avec un manque.
 * Vert = attaque bloquée ; rouge = trou. Sortie brute `[CVF2B-3]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { service } from '../parcours/paiement-helpers';
import { newPartner, superadminId, type TestPartner } from '../parcours/finance-helpers';
import { createDraftEvent, posterUrl, rpcTransition, storedPosterUrl } from '../parcours/cycle-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { anonClient, restRpc, userClient } from './cvf1-helpers';
import {
    api, eventSnapshot, letters, missingInBase, putFresh, show, statusOf, transition, versionOf,
    type Reply, type Row,
} from './cvf2b-34-helpers';

const DAY = 86_400_000;
const STD = 'Standard';
let A: TestPartner;
let B: TestPartner;

before(async () => {
    A = await newPartner('cvf2b3-a');
    B = await newPartner('cvf2b3-b');
});

after(async () => {
    await assertFinition1Invariants('cvf2b-3-soumission');
});

function log(line: string): void {
    console.log(`[CVF2B-3] ${line}`);
}

function list(lines: string[]): string {
    return lines.map((l) => `  - ${l}`).join('\n');
}

function missingFields(r: Reply): string[] {
    return Array.isArray(r.body.missing) ? (r.body.missing as Row[]).map((m) => String(m.field)) : [];
}

function day(offset: number): string {
    return new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
}

/** Corps complet de POST /api/partner/events (comme le formulaire), affiche réellement déposée. */
function formBody(title: string, poster: string | null, extra: Row = {}): Row {
    return {
        title, category: 'CONCERT', start_date: day(10), start_time: '20:00', end_date: day(10), end_time: '23:30',
        location: 'Esplanade de test', city: 'Dakar', latitude: 14.6937, longitude: -17.4441,
        ...(poster === null ? {} : { image_url: poster }), capacity: 200,
        ticket_categories: [{ name: STD, price: 0, total_quantity: 50 }],
        ...extra,
    };
}

function categoryPath(eventId: string, categoryId: string) {
    return { path: `/api/partner/events/${eventId}/categories/${categoryId}`, params: { id: eventId, categoryId } };
}

/** Soumission refusée : 4xx, aucun passage EN_ATTENTE, rien d'écrit. Rend la réponse. */
async function refusedSubmission(token: string, eventId: string, label: string): Promise<Reply> {
    const before = await eventSnapshot(eventId);
    const r = await transition(token, eventId, 'EN_ATTENTE');
    const after = await eventSnapshot(eventId);
    log(`${label} → ${show(r)} ; statut après : ${await statusOf(eventId)}`);
    assert.ok(r.status >= 400 && r.status < 500, `${label} : soumission acceptée alors qu'il manque quelque chose : ${show(r)}`);
    assert.equal(await statusOf(eventId), 'BROUILLON', `${label} : l'événement a quitté le brouillon : ${show(r)}`);
    assert.equal(after, before, `${label} : un refus a écrit quelque chose.\navant : ${before}\naprès : ${after}`);
    return r;
}

// ── a. Route : un manque à la fois ──────────────────────────────────────────

describe('a. route de soumission : chaque manque refusé, rien d’écrit', () => {
    const ok = [{ name: STD, price: 0, total: 20 }];
    const cases: Array<{ label: string; field: string; code: string; make: () => Promise<string> }> = [
        { label: 'sans affiche', field: 'image_url', code: 'SUBMIT_INCOMPLETE',
            make: async () => (await createDraftEvent(A, 'cvf2b3-sans-affiche', ok, { startsInHours: 72, imageUrl: null })).eventId },
        { label: 'sans repère sur la carte', field: 'latitude', code: 'POSITION_REQUIRED',
            make: async () => (await createDraftEvent(A, 'cvf2b3-sans-repere', ok, { startsInHours: 72, position: null })).eventId },
        { label: 'aucune catégorie', field: 'ticket_categories', code: 'SUBMIT_INCOMPLETE',
            make: async () => (await createDraftEvent(A, 'cvf2b3-sans-categorie', [], { startsInHours: 72 })).eventId },
        { label: 'seule catégorie désactivée', field: 'ticket_categories', code: 'SUBMIT_INCOMPLETE',
            make: async () => (await createDraftEvent(A, 'cvf2b3-inactive', [{ name: STD, price: 0, total: 20, isActive: false }], { startsInHours: 72 })).eventId },
        { label: 'début passé', field: 'start_date', code: 'SUBMIT_INCOMPLETE',
            make: async () => (await createDraftEvent(A, 'cvf2b3-passe', ok, { startsInHours: -1 })).eventId },
        { label: 'fin de vente après la fin de l’événement', field: 'ticket_categories', code: 'SUBMIT_INCOMPLETE',
            make: async () => (await createDraftEvent(A, 'cvf2b3-fin-vente', [{ name: STD, price: 0, total: 20, saleEnd: new Date(Date.now() + 9 * DAY).toISOString() }], { startsInHours: 72, durationHours: 4 })).eventId },
        { label: 'début de vente après la fin de l’événement', field: 'ticket_categories', code: 'SUBMIT_INCOMPLETE',
            make: async () => (await createDraftEvent(A, 'cvf2b3-debut-vente', [{ name: STD, price: 0, total: 20, saleStart: new Date(Date.now() + 80 * 3600_000).toISOString() }], { startsInHours: 72, durationHours: 4 })).eventId },
        { label: 'tous les manques ensemble', field: 'image_url', code: 'SUBMIT_INCOMPLETE',
            make: async () => (await createDraftEvent(A, 'cvf2b3-tout', [], { startsInHours: -1, imageUrl: null, position: null })).eventId },
    ];
    for (const c of cases) {
        test(c.label, async () => {
            const eventId = await c.make();
            const r = await refusedSubmission(A.accessToken, eventId, c.label);
            assert.equal(r.status, 422, `refus attendu en 422 : ${show(r)}`);
            assert.equal(r.body.code, c.code, show(r));
            assert.ok(missingFields(r).includes(c.field), `le manque « ${c.field} » n'est pas nommé : ${show(r)}`);
        });
    }

    test('témoin : un brouillon complet passe EN_ATTENTE par la même route', async () => {
        const ev = await createDraftEvent(A, 'cvf2b3-temoin', ok, { startsInHours: 72 });
        const r = await transition(A.accessToken, ev.eventId, 'EN_ATTENTE');
        log(`témoin complet → ${show(r)}`);
        assert.equal(r.status, 200, show(r));
        assert.equal(await statusOf(ev.eventId), 'EN_ATTENTE');
    });
});

// ── b. Parcours du formulaire ───────────────────────────────────────────────

describe('b. formulaire : manque ajouté par les routes de modification, puis envoi', () => {
    let eventId = '';
    let categoryId = '';
    let poster = '';

    before(async () => {
        poster = await storedPosterUrl(A.partnerId);
        const created = await api('POST', 'partner/events', { token: A.accessToken, body: formBody(`Soirée formulaire ${letters()}`, poster) });
        log(`création par le formulaire → ${show(created).slice(0, 300)}`);
        assert.equal(created.status, 201, `création (montage) : ${show(created)}`);
        eventId = String((created.body.event as Row).id);
        const { data, error } = await service.from('ticket_categories').select('id').eq('event_id', eventId).single();
        assert.equal(error, null, `catégorie (montage) : ${error?.message}`);
        categoryId = String(data!.id);
        assert.equal(await statusOf(eventId), 'BROUILLON');
    });

    /** Affiche remise : la route efface l'affiche retirée qu'aucun événement ne cite plus, on en dépose une neuve. */
    async function restorePoster(): Promise<void> {
        poster = await storedPosterUrl(A.partnerId);
        const back = await putFresh(A.accessToken, eventId, { image_url: poster });
        assert.equal(back.status, 200, `affiche remise (montage) : ${show(back)}`);
    }

    /**
     * Manque ajouté par une route, puis envoi. Si la route refuse le retrait, l'attaque s'arrête là (rien ne doit avoir
     * changé) ; sinon l'envoi doit être refusé et nommer le manque. Rend vrai si le retrait a été enregistré.
     */
    async function stripThenSubmit(label: string, field: string, strip: () => Promise<Reply>): Promise<boolean> {
        const before = await eventSnapshot(eventId);
        const s = await strip();
        log(`${label} → ${show(s).slice(0, 200)}`);
        if (s.status >= 400) {
            assert.equal(await eventSnapshot(eventId), before, `${label} : refusé mais quelque chose a changé`);
            return false;
        }
        const r = await refusedSubmission(A.accessToken, eventId, `envoi après « ${label} »`);
        assert.ok(missingFields(r).includes(field), `le manque « ${field} » n'est pas nommé : ${show(r)}`);
        return true;
    }

    test('affiche retirée par PUT, puis envoi : refusé', async () => {
        if (await stripThenSubmit('affiche retirée (PUT image_url null)', 'image_url', () => putFresh(A.accessToken, eventId, { image_url: null }))) {
            await restorePoster();
        }
    });

    test('affiche « vide » (espaces) par PUT, puis envoi : refusé', async () => {
        if (await stripThenSubmit('affiche faite d’espaces (PUT)', 'image_url', () => putFresh(A.accessToken, eventId, { image_url: '   ' }))) {
            await restorePoster();
        }
    });

    test('repère retiré par PUT, puis envoi : refusé', async () => {
        if (await stripThenSubmit('repère retiré (PUT latitude et longitude null)', 'latitude', () => putFresh(A.accessToken, eventId, { latitude: null, longitude: null }))) {
            const back = await putFresh(A.accessToken, eventId, { latitude: 14.6937, longitude: -17.4441 });
            assert.equal(back.status, 200, `repère remis (montage) : ${show(back)}`);
        }
    });

    test('seule catégorie désactivée par la route des catégories, puis envoi : refusé', async () => {
        const path = categoryPath(eventId, categoryId);
        if (await stripThenSubmit('seule catégorie désactivée (PATCH is_active false)', 'ticket_categories',
            () => api('PATCH', 'partner/events/[id]/categories/[categoryId]', { token: A.accessToken, ...path, body: { is_active: false } }))) {
            const on = await api('PATCH', 'partner/events/[id]/categories/[categoryId]', { token: A.accessToken, ...path, body: { is_active: true } });
            assert.equal(on.status, 200, `catégorie réactivée (montage) : ${show(on)}`);
        }
    });

    test('dates absentes ou incohérentes : refusées à l’écriture, l’événement ne change pas', async () => {
        const before = await eventSnapshot(eventId);
        const attempts: Array<[string, Row]> = [
            ['fin avant le début', { end_date: day(9), end_time: '23:30' }],
            ['fin égale au début', { end_date: day(10), end_time: '20:00' }],
            ['heure de fin sans date de fin', { end_date: null, end_time: '23:30' }],
            ['début absent (null)', { start_date: null }],
            ['heure de début vide', { start_time: '' }],
            ['début illisible', { start_date: '2026-02-30' }],
            ['début passé', { start_date: day(-1), start_time: '20:00' }],
            ['début après la fin', { start_date: day(11), start_time: '20:00' }],
        ];
        const accepted: string[] = [];
        for (const [label, patch] of attempts) {
            const r = await api('PUT', 'partner/events/[id]', {
                token: A.accessToken, path: `/api/partner/events/${eventId}`, params: { id: eventId },
                body: { patch, expected_updated_at: await versionOf(eventId) },
            });
            log(`dates : ${label} → ${show(r).slice(0, 220)}`);
            if (r.status < 400) accepted.push(`${label} → ${show(r).slice(0, 200)}`);
        }
        const after = await eventSnapshot(eventId);
        assert.deepEqual(accepted, [], `dates absentes ou incohérentes acceptées :\n${list(accepted)}`);
        assert.equal(after, before, `les dates ont changé :\navant : ${before}\naprès : ${after}`);
    });

    test('seule catégorie supprimée, puis envoi : refusé ; témoin : une catégorie ajoutée, l’envoi passe', async () => {
        const deleted = await stripThenSubmit('seule catégorie supprimée (DELETE)', 'ticket_categories',
            () => api('DELETE', 'partner/events/[id]/categories/[categoryId]', { token: A.accessToken, ...categoryPath(eventId, categoryId) }));
        if (deleted) {
            const add = await api('POST', 'partner/events/[id]/categories', {
                token: A.accessToken, path: `/api/partner/events/${eventId}/categories`, params: { id: eventId },
                body: { name: 'Entrée', price: 0, total_quantity: 30 },
            });
            assert.ok(add.status < 300, `catégorie ajoutée (montage) : ${show(add)}`);
        }
        const witness = await transition(A.accessToken, eventId, 'EN_ATTENTE');
        log(`témoin du formulaire complet → ${show(witness)}`);
        assert.equal(witness.status, 200, `témoin : le formulaire complet doit passer : ${show(witness)}`);
        assert.deepEqual(await missingInBase(eventId), []);
    });
});

// ── c. Création « déjà soumise » ────────────────────────────────────────────

describe('c. création directe en attente de validation : statut ou drapeau dans le corps', () => {
    test('statut EN_ATTENTE ou PUBLIE, drapeau d’envoi : refusés ou ignorés, jamais hors du brouillon', async () => {
        const since = new Date(Date.now() - 1_000).toISOString();
        const tag = letters();
        const bodies: Array<[string, Row]> = [
            ['status EN_ATTENTE, sans affiche', formBody(`Directe ${tag} un`, null, { status: 'EN_ATTENTE' })],
            ['status PUBLIE, sans affiche', formBody(`Directe ${tag} deux`, null, { status: 'PUBLIE' })],
            ['submit true, sans affiche', formBody(`Directe ${tag} trois`, null, { submit: true })],
            ['to EN_ATTENTE, sans affiche ni repère', formBody(`Directe ${tag} quatre`, null, { to: 'EN_ATTENTE', latitude: null, longitude: null })],
            ['submitted_at posé', formBody(`Directe ${tag} cinq`, null, { submitted_at: new Date().toISOString() })],
        ];
        for (const [label, body] of bodies) {
            const r = await api('POST', 'partner/events', { token: A.accessToken, body });
            log(`création « ${label} » → ${show(r).slice(0, 260)}`);
        }
        const { data, error } = await service.from('events').select('id, title, status').eq('partner_id', A.partnerId).gte('created_at', since).like('title', `Directe ${tag}%`);
        assert.equal(error, null, error?.message);
        log(`événements créés : ${JSON.stringify(data)}`);
        const outOfDraft = (data ?? []).filter((e) => e.status !== 'BROUILLON').map((e) => `${e.title} : ${e.status}`);
        assert.deepEqual(outOfDraft, [], `événement créé hors du brouillon :\n${list(outOfDraft)}`);
    });

    test('brouillon sans affiche créé par le formulaire : l’envoi est refusé', async () => {
        const r = await api('POST', 'partner/events', { token: A.accessToken, body: formBody(`Sans affiche ${letters()}`, null) });
        log(`création sans affiche → ${show(r).slice(0, 200)}`);
        assert.equal(r.status, 201, `brouillon sans affiche (montage) : ${show(r)}`);
        const eventId = String((r.body.event as Row).id);
        const refused = await refusedSubmission(A.accessToken, eventId, 'envoi du brouillon sans affiche');
        assert.ok(missingFields(refused).includes('image_url'), show(refused));
    });
});

// ── d. REST et RPC directes ─────────────────────────────────────────────────

describe('d. REST et RPC de Supabase avec la session de l’organisatrice', () => {
    test('statut écrit, historique, catégorie, fonctions de soumission : tout refusé, l’événement ne change pas', async () => {
        const ev = await createDraftEvent(A, 'cvf2b3-rest', [], { startsInHours: 72, imageUrl: null, position: null });
        const before = await eventSnapshot(ev.eventId);
        const version = await versionOf(ev.eventId);
        const db = userClient(A.accessToken);
        const anon = anonClient();
        const accepted: string[] = [];
        const tryWrite = async (label: string, q: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>) => {
            const { data, error } = await q;
            const rows = Array.isArray(data) ? data.length : data ? 1 : 0;
            log(`${label} → ${error ? `${error.code ?? ''} ${error.message}` : `aucune erreur, ${rows} ligne(s)`}`);
            if (!error && rows > 0) accepted.push(`${label} : ${JSON.stringify(data).slice(0, 200)}`);
        };
        const tryRpc = async (label: string, client: typeof db, fn: string, args: Row) => {
            const r = await restRpc(client, fn, args);
            log(`${label} → ${r.ok ? `exécutée : ${JSON.stringify(r.data).slice(0, 200)}` : r.error}`);
            if (r.ok) accepted.push(`${label} : ${JSON.stringify(r.data).slice(0, 200)}`);
        };
        const p = { event_id: ev.eventId, actor_id: A.userId, to_status: 'EN_ATTENTE' };

        await tryWrite('PATCH events status=EN_ATTENTE', db.from('events').update({ status: 'EN_ATTENTE' }).eq('id', ev.eventId).select('id'));
        await tryWrite('PATCH events affiche + repère', db.from('events').update({ image_url: posterUrl(A.partnerId), latitude: 14.69, longitude: -17.44 }).eq('id', ev.eventId).select('id'));
        await tryWrite('POST event_status_history', db.from('event_status_history').insert({
            event_id: ev.eventId, old_status: 'BROUILLON', new_status: 'EN_ATTENTE', actor_id: A.userId, actor_role: 'PARTENAIRE', channel: 'TRANSITION',
        }).select('id'));
        await tryWrite('POST ticket_categories (catégorie active)', db.from('ticket_categories').insert({
            event_id: ev.eventId, name: 'Fantôme', price: 0, total_quantity: 10, sold_quantity: 0, is_active: true,
        }).select('id'));
        await tryWrite('UPSERT events (même id, statut EN_ATTENTE)', db.from('events').upsert({ id: ev.eventId, partner_id: A.partnerId, status: 'EN_ATTENTE', title: 'x', start_date: day(5), start_time: '20:00', location: 'x', city: 'Dakar' }).select('id'));
        await tryRpc('RPC event_transition (session)', db, 'event_transition', { p });
        await tryRpc('RPC event_transition (sans session)', anon, 'event_transition', { p });
        await tryRpc('RPC event_status_apply', db, 'event_status_apply', {
            p_event: ev.eventId, p_from: 'BROUILLON', p_to: 'EN_ATTENTE', p_actor: A.userId, p_role: 'PARTENAIRE', p_reason: null, p_channel: 'TRANSITION',
        });
        await tryRpc('RPC event_update (affiche, repère)', db, 'event_update', { p: {
            event_id: ev.eventId, actor_id: A.userId, expected_updated_at: version,
            patch: { image_url: posterUrl(A.partnerId), latitude: 14.69, longitude: -17.44 },
        } });
        await tryRpc('RPC event_update_preview', db, 'event_update_preview', { p: {
            event_id: ev.eventId, actor_id: A.userId, expected_updated_at: version, patch: { title: 'Aperçu direct' },
        } });
        await tryRpc('RPC event_create (statut EN_ATTENTE)', db, 'event_create', { p: {
            actor_id: A.userId,
            event: { partner_id: A.partnerId, title: 'Création directe', category: 'CONCERT', start_date: day(5), start_time: '20:00', location: 'Salle', city: 'Dakar', status: 'EN_ATTENTE' },
            ticket_categories: [],
        } });

        const after = await eventSnapshot(ev.eventId);
        assert.deepEqual(accepted, [], `écritures ou fonctions acceptées par la REST :\n${list(accepted)}`);
        assert.equal(await statusOf(ev.eventId), 'BROUILLON');
        assert.equal(after, before, `l'événement a changé :\navant : ${before}\naprès : ${after}`);
        const { count, error } = await service.from('events').select('id', { count: 'exact', head: true })
            .eq('partner_id', A.partnerId).eq('title', 'Création directe');
        assert.equal(error, null, error?.message);
        assert.equal(count, 0, 'event_create appelée par la REST a créé un événement');
    });
});

// ── e. Événement d'une autre organisatrice ──────────────────────────────────

describe('e. événement d’une autre organisatrice', () => {
    test('soumettre, retirer, publier, modifier, compléter le brouillon de B avec la session de A : refusé', async () => {
        const ok = [{ name: STD, price: 0, total: 20 }];
        const draft = await createDraftEvent(B, 'cvf2b3-autre-brouillon', ok, { startsInHours: 72 });
        const incomplete = await createDraftEvent(B, 'cvf2b3-autre-incomplet', ok, { startsInHours: 72, imageUrl: null });
        const pending = await createDraftEvent(B, 'cvf2b3-autre-attente', ok, { startsInHours: 72 });
        const sub = await rpcTransition(pending.eventId, B.userId, 'EN_ATTENTE');
        assert.equal((sub.data as Row | null)?.ok, true, `soumission par B (montage) : ${JSON.stringify(sub)}`);
        const validated = await createDraftEvent(B, 'cvf2b3-autre-valide', ok, { startsInHours: 72 });
        const s1 = await rpcTransition(validated.eventId, B.userId, 'EN_ATTENTE');
        assert.equal((s1.data as Row | null)?.ok, true, `soumission par B (montage) : ${JSON.stringify(s1)}`);
        const s2 = await rpcTransition(validated.eventId, await superadminId(), 'VALIDE');
        assert.equal((s2.data as Row | null)?.ok, true, `validation (montage) : ${JSON.stringify(s2)}`);

        const ids = [draft.eventId, incomplete.eventId, pending.eventId, validated.eventId];
        const before = await Promise.all(ids.map(eventSnapshot));
        const accepted: string[] = [];
        const record = (label: string, r: Reply) => {
            log(`A sur l'événement de B : ${label} → ${show(r).slice(0, 220)}`);
            if (r.status < 400) accepted.push(`${label} → ${show(r).slice(0, 200)}`);
        };
        record('soumettre le brouillon complet', await transition(A.accessToken, draft.eventId, 'EN_ATTENTE'));
        record('soumettre le brouillon incomplet', await transition(A.accessToken, incomplete.eventId, 'EN_ATTENTE'));
        record('retirer de la validation', await transition(A.accessToken, pending.eventId, 'BROUILLON'));
        record('publier l’événement validé', await transition(A.accessToken, validated.eventId, 'PUBLIE'));
        record('compléter l’affiche du brouillon incomplet (PUT)', await api('PUT', 'partner/events/[id]', {
            token: A.accessToken, path: `/api/partner/events/${incomplete.eventId}`, params: { id: incomplete.eventId },
            body: { patch: { image_url: posterUrl(A.partnerId) }, expected_updated_at: await versionOf(incomplete.eventId) },
        }));
        record('aperçu d’une modification (notice-preview)', await api('POST', 'partner/events/[id]/notice-preview', {
            token: A.accessToken, path: `/api/partner/events/${validated.eventId}/notice-preview`, params: { id: validated.eventId },
            body: { patch: { location: 'Ailleurs' }, expected_updated_at: await versionOf(validated.eventId) },
        }));
        record('désactiver la catégorie du brouillon complet', await api('PATCH', 'partner/events/[id]/categories/[categoryId]', {
            token: A.accessToken, ...categoryPath(draft.eventId, draft.categories[STD].id), body: { is_active: false },
        }));
        record('ajouter une catégorie au brouillon incomplet', await api('POST', 'partner/events/[id]/categories', {
            token: A.accessToken, path: `/api/partner/events/${incomplete.eventId}/categories`, params: { id: incomplete.eventId },
            body: { name: 'Intruse', price: 0, total_quantity: 5 },
        }));
        const db = userClient(A.accessToken);
        for (const [label, eventId] of [['brouillon complet', draft.eventId], ['validé (PUBLIE)', validated.eventId]] as const) {
            const to = eventId === validated.eventId ? 'PUBLIE' : 'EN_ATTENTE';
            const r = await restRpc(db, 'event_transition', { p: { event_id: eventId, actor_id: B.userId, to_status: to } });
            log(`RPC event_transition au nom de B (${label}) → ${r.ok ? JSON.stringify(r.data) : r.error}`);
            if (r.ok && (r.data as Row | null)?.ok === true) accepted.push(`RPC event_transition au nom de B (${label}) : ${JSON.stringify(r.data)}`);
        }

        const after = await Promise.all(ids.map(eventSnapshot));
        assert.deepEqual(accepted, [], `actions de A acceptées sur les événements de B :\n${list(accepted)}`);
        assert.deepEqual(after, before, 'un événement de B a changé');
        assert.deepEqual(await Promise.all(ids.map(statusOf)), ['BROUILLON', 'BROUILLON', 'EN_ATTENTE', 'VALIDE']);
    });
});

// ── f. Courses : retrait d'un manque pendant l'envoi ────────────────────────

describe('f. courses : un manque ajouté en même temps que l’envoi', () => {
    const ROUNDS = 4;
    const kinds: Array<{ label: string; strip: (eventId: string, categoryId: string) => Promise<Reply> }> = [
        { label: 'affiche retirée', strip: async (id) => putFresh(A.accessToken, id, { image_url: null }) },
        { label: 'repère retiré', strip: async (id) => putFresh(A.accessToken, id, { latitude: null, longitude: null }) },
        { label: 'seule catégorie désactivée', strip: (id, cat) => api('PATCH', 'partner/events/[id]/categories/[categoryId]', { token: A.accessToken, ...categoryPath(id, cat), body: { is_active: false } }) },
        { label: 'seule catégorie supprimée', strip: (id, cat) => api('DELETE', 'partner/events/[id]/categories/[categoryId]', { token: A.accessToken, ...categoryPath(id, cat) }) },
    ];
    for (const k of kinds) {
        test(`${k.label} pendant la soumission (${ROUNDS} tours, Promise.all) : jamais EN_ATTENTE avec un manque`, async () => {
            const breaches: string[] = [];
            const outcomes: string[] = [];
            for (let round = 1; round <= ROUNDS; round++) {
                const ev = await createDraftEvent(A, `cvf2b3-course-${round}`, [{ name: STD, price: 0, total: 20 }], { startsInHours: 72 });
                const catId = ev.categories[STD].id;
                // Ordre de départ alterné : le retrait part avant la soumission un tour sur deux
                let strip: Reply;
                let submit: Reply;
                if (round % 2 === 1) {
                    [strip, submit] = await Promise.all([k.strip(ev.eventId, catId), transition(A.accessToken, ev.eventId, 'EN_ATTENTE')]);
                } else {
                    [submit, strip] = await Promise.all([transition(A.accessToken, ev.eventId, 'EN_ATTENTE'), k.strip(ev.eventId, catId)]);
                }
                const status = await statusOf(ev.eventId);
                const missing = await missingInBase(ev.eventId);
                outcomes.push(`tour ${round} : retrait HTTP ${strip.status} ${String(strip.body.code ?? '')}, envoi HTTP ${submit.status} ${String(submit.body.code ?? '')}, statut ${status}, manques ${JSON.stringify(missing)}`);
                if (status !== 'BROUILLON' && missing.length > 0) {
                    breaches.push(`tour ${round} : ${status} avec ${JSON.stringify(missing)} (retrait ${show(strip).slice(0, 120)} ; envoi ${show(submit).slice(0, 120)})`);
                }
            }
            for (const o of outcomes) log(`course « ${k.label} » ${o}`);
            assert.deepEqual(breaches, [], `événement soumis avec un manque :\n${list(breaches)}`);
        });
    }
});
