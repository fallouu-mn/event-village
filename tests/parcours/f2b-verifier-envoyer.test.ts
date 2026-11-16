/**
 * Finition 2b (C, E-24) — « Vérifier avant d'envoyer » : récapitulatif de toutes les étapes avec « Modifier », liste
 * claire de ce qui manque, « Envoyer pour validation » depuis le formulaire (la soumission depuis la liste reste).
 *  a. Parité des manques : pour des brouillons qui manquent d'affiche, de repère, de catégorie active, dont le début est
 *     passé ou dont une période de vente dépasse la fin, submissionMissing (lib/events/submission-check.ts, écran) rend
 *     exactement les champs et les textes du refus de la base (event_transition → EN_ATTENTE, `missing`) ; un brouillon
 *     complet : aucun manque, et la base l'accepte.
 *  b. Écran : écran « Vérifier avant d'envoyer » (récapitulatif, « Modifier » par étape, manques), « Envoyer pour
 *     validation » qui crée puis envoie (POST …/transition { to: 'EN_ATTENTE' }) ; la soumission depuis la liste reste.
 * Rouge avant le correctif : module et écran absents. Sortie brute `[F2B-C1]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { importModule, service } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { createDraftEvent, rpcTransition } from './cycle-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';

type Row = Record<string, unknown>;
const ROOT = process.cwd();

let P: TestPartner;

before(async () => {
    P = await newPartner('f2b-verifier');
});

after(async () => {
    await assertFinition1Invariants('f2b-verifier-envoyer');
});

interface Missing { field: string; message: string }

async function screenMissing(eventId: string): Promise<Missing[]> {
    const mod = await importModule('../../lib/events/submission-check');
    assert.equal(typeof mod.submissionMissing, 'function', 'submissionMissing exportée par lib/events/submission-check.ts');
    const { data: ev, error } = await service.from('events')
        .select('image_url, latitude, longitude, start_date, start_time, end_date, end_time').eq('id', eventId).single();
    assert.equal(error, null, error?.message);
    const { data: cats } = await service.from('ticket_categories').select('name, is_active, sale_start, sale_end').eq('event_id', eventId);
    const items = (mod.submissionMissing as (i: Row) => Array<{ field: string; message: string }>)({
        image_url: ev.image_url, latitude: ev.latitude === null ? null : Number(ev.latitude), longitude: ev.longitude === null ? null : Number(ev.longitude),
        start_date: ev.start_date, start_time: ev.start_time, end_date: ev.end_date, end_time: ev.end_time,
        categories: (cats ?? []).map((c) => ({ name: c.name, is_active: c.is_active, sale_start: c.sale_start, sale_end: c.sale_end })),
    });
    return items.map((m) => ({ field: m.field, message: m.message }));
}

async function baseMissing(eventId: string): Promise<{ ok: boolean; missing: Missing[] }> {
    const r = await rpcTransition(eventId, P.userId, 'EN_ATTENTE');
    assert.equal(r.error, null, r.error?.message);
    const data = (r.data ?? {}) as Row;
    const missing = Array.isArray(data.missing) ? (data.missing as Row[]).map((m) => ({ field: String(m.field), message: String(m.message) })) : [];
    return { ok: data.ok === true, missing };
}

describe('a. parité des manques entre l’écran et la base', () => {
    const DAY = 86_400_000;
    const cases: Array<[string, () => Promise<string>]> = [
        ['sans affiche, sans repère, aucune catégorie active', async () => (await createDraftEvent(P, 'f2b-c1-vide',
            [{ name: 'Standard', price: 0, total: 10, isActive: false }], { startsInHours: 72, imageUrl: null, position: null })).eventId],
        ['début passé', async () => (await createDraftEvent(P, 'f2b-c1-passe', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: -2 })).eventId],
        ['période de vente au-delà de la fin', async () => (await createDraftEvent(P, 'f2b-c1-vente', [
            { name: 'Standard', price: 0, total: 10 },
            { name: 'Tardive', price: 0, total: 5, saleEnd: new Date(Date.now() + 5 * DAY).toISOString() },
        ], { startsInHours: 48, durationHours: 4 })).eventId],
    ];
    for (const [label, make] of cases) {
        test(label, async () => {
            const eventId = await make();
            const screen = await screenMissing(eventId);
            const base = await baseMissing(eventId);
            console.log(`[F2B-C1] ${label} : écran ${JSON.stringify(screen)} ; base ${JSON.stringify(base)}`);
            assert.equal(base.ok, false, 'la base aurait dû refuser');
            assert.ok(screen.length > 0, 'aucun manque à l’écran');
            assert.deepEqual(screen, base.missing);
        });
    }

    test('brouillon complet : aucun manque, la base l’accepte', async () => {
        const ev = await createDraftEvent(P, 'f2b-c1-complet', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 72 });
        assert.deepEqual(await screenMissing(ev.eventId), []);
        const base = await baseMissing(ev.eventId);
        assert.equal(base.ok, true, JSON.stringify(base));
    });
});

describe('b. écran « Vérifier avant d’envoyer » et envoi depuis le formulaire', () => {
    const form = fs.readFileSync(path.join(ROOT, 'components/events/EventForm.tsx'), 'utf8');
    const review = fs.readFileSync(path.join(ROOT, 'components/events/EventReview.tsx'), 'utf8');
    test('récapitulatif des étapes avec « Modifier », manques, « Envoyer pour validation »', () => {
        assert.match(review, /Vérifier avant d’envoyer/);
        assert.match(review, /Modifier/);
        assert.match(review, /submissionMissing|missing/);
        assert.match(review, /Envoyer pour validation/);
    });
    test('le formulaire envoie pour validation (transition EN_ATTENTE) après la création ou l’enregistrement', () => {
        assert.match(form, /\/transition/);
        assert.match(form, /EN_ATTENTE/);
    });
    test('la soumission depuis la liste reste', () => {
        const list = fs.readFileSync(path.join(ROOT, 'components/partner/events-list/PartnerEventCard.tsx'), 'utf8');
        assert.match(list, /EN_ATTENTE|Soumettre|soumettre/);
    });
});
