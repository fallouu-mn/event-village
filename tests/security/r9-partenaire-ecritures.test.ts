/**
 * R9 — Lot 1B.4 : un partenaire ne modifie ses événements et catégories que par les routes
 * serveur. Par REST, il ne publie pas son brouillon, ne se met pas en avant, ne touche pas aux
 * compteurs de stock, ne crée pas d'événement. Il ne lit pas les annulations des autres
 * partenaires et n'écrit aucune annulation.
 *
 * Une écriture refusée par la RLS peut prendre deux formes : une erreur (INSERT) ou zéro ligne
 * modifiée (UPDATE). Si une écriture passe (base non corrigée), le test la remet en l'état.
 * (Clé anon + signInWithPassword uniquement.)
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PostgrestError } from '@supabase/supabase-js';
import { FIXTURE_EVENTS } from '../helpers/fixture-data';
import { assertDenied, publicEvent, signInFixture, uniqueSuffix } from './helpers';

function wasWritten(res: { data: unknown[] | null; error: PostgrestError | null }): boolean {
    return !res.error && Array.isArray(res.data) && res.data.length > 0;
}

async function partnerA() {
    const a = await signInFixture('PARTNER_A');
    const { data: partner, error } = await a.client.from('partners').select('id').eq('user_id', a.userId).single();
    assert.equal(error, null, `lecture de sa fiche partenaire : ${error?.message}`);
    return { ...a, partnerId: partner.id as string };
}

describe('R9 — écritures partenaire par REST', () => {
    test('partenaire A qui passe son BROUILLON en PUBLIE → refusé', async () => {
        const a = await partnerA();
        const { data: draft, error } = await a.client.from('events').select('id, status').eq('slug', FIXTURE_EVENTS.A_BROUILLON.slug).single();
        assert.equal(error, null, `lecture de son brouillon : ${error?.message}`);
        assert.equal(draft.status, 'BROUILLON', 'précondition');
        const res = await a.client.from('events').update({ status: 'PUBLIE' }).eq('id', draft.id).select('id, status');
        if (wasWritten(res)) await a.client.from('events').update({ status: 'BROUILLON' }).eq('id', draft.id);
        assert.ok(!wasWritten(res), `publication directe acceptée : ${JSON.stringify(res.data)}`);
    });

    test('partenaire A qui met son événement en avant (is_featured) → refusé', async () => {
        const a = await partnerA();
        const ev = await publicEvent('A_PUBLIE');
        const res = await a.client.from('events').update({ is_featured: true }).eq('id', ev.eventId).select('id, is_featured');
        if (wasWritten(res)) await a.client.from('events').update({ is_featured: false }).eq('id', ev.eventId);
        assert.ok(!wasWritten(res), `mise en avant directe acceptée : ${JSON.stringify(res.data)}`);
    });

    test('partenaire A qui modifie sold_quantity / held_quantity de sa catégorie → refusé', async () => {
        const a = await partnerA();
        const ev = await publicEvent('A_PUBLIE');
        const categoryId = ev.categories.Standard.id;
        const { data: before, error } = await a.client.from('ticket_categories').select('sold_quantity, held_quantity').eq('id', categoryId).single();
        assert.equal(error, null, `lecture de sa catégorie : ${error?.message}`);
        const res = await a.client.from('ticket_categories').update({ sold_quantity: 0, held_quantity: 0 }).eq('id', categoryId).select('id');
        if (wasWritten(res)) await a.client.from('ticket_categories').update(before).eq('id', categoryId);
        assert.ok(!wasWritten(res), 'modification directe des compteurs de stock acceptée');
    });

    test('partenaire A qui crée un événement PUBLIE par REST → refusé', async () => {
        const a = await partnerA();
        const slug = `r9-direct-${uniqueSuffix().toLowerCase()}`;
        const res = await a.client.from('events').insert({
            partner_id: a.partnerId,
            title: 'R9 événement créé hors serveur',
            slug,
            description: 'Tentative de création directe',
            start_date: '2027-01-15',
            start_time: '20:00:00',
            end_date: '2027-01-15',
            end_time: '23:00:00',
            location: 'Dakar',
            city: 'Dakar',
            capacity: 50,
            status: 'PUBLIE',
            category: 'CONCERT',
        }).select('id');
        if (wasWritten(res)) await a.client.from('events').delete().eq('slug', slug);
        assertDenied(res.error, 'création directe d\'un événement');
    });

    test('partenaire A qui lit les annulations de B → rien', async () => {
        const a = await partnerA();
        const { data: own, error: ownErr } = await a.client.from('events').select('id').eq('partner_id', a.partnerId);
        assert.equal(ownErr, null, `lecture de ses événements : ${ownErr?.message}`);
        const ownIds = new Set((own || []).map((e) => e.id));
        const { data, error } = await a.client.from('event_cancellations').select('id, event_id');
        assert.equal(error, null, `lecture des annulations : ${error?.message}`);
        const foreign = (data || []).filter((c) => !ownIds.has(c.event_id));
        assert.deepEqual(foreign, [], `annulations d'autres partenaires lisibles : ${foreign.length}`);
    });

    test('partenaire A qui écrit une annulation par REST → refusé', async () => {
        const a = await partnerA();
        const { data: draft } = await a.client.from('events').select('id').eq('slug', FIXTURE_EVENTS.A_BROUILLON.slug).single();
        const res = await a.client.from('event_cancellations').insert({
            event_id: draft?.id,
            cancelled_by: a.userId,
            internal_reason: 'R9 annulation directe',
        }).select('id');
        if (wasWritten(res)) await a.client.from('event_cancellations').delete().eq('id', (res.data as { id: string }[])[0].id);
        assertDenied(res.error, 'écriture directe dans event_cancellations');
    });
});
