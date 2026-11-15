/**
 * Correctifs de la contre-vérification de la finition 1 — R1 : porte supprimée pendant l'enregistrement des réglages d'un
 * contrôleur. Refus « Cette porte n'existe plus. Choisissez-en une autre. » (409 GATE_GONE), jamais une erreur 500 ;
 * la porte du contrôleur ne change pas.
 *  a. Suppression validée pendant que l'enregistrement attend (transaction concurrente, comme cvf1-8).
 *  b. Porte supprimée avant l'enregistrement : même refus.
 *  c. Porte d'un autre événement : refus « Porte inconnue » inchangé (GATE_INVALID).
 * Rouge avant le correctif : 500 « Enregistrement momentanément impossible. Réessayez. » (clé étrangère), run 205 § 3.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { service, type Buyer } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { newController } from './acces-helpers';
import { createZonedEvent, type ZonedEvent } from './zones-helpers';
import { openConcurrentClient, waitForLockWaiters } from '../helpers/db';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { CATS, FREE, PAID, api, assignmentOf, show, type Reply } from '../audit/cvf1-helpers';

const GATE_GONE_TEXT = 'Cette porte n’existe plus. Choisissez-en une autre.';

let P: TestPartner;
let Z: ZonedEvent;
let Z2: ZonedEvent;
let c: Buyer;
let north: string;

before(async () => {
    P = await newPartner('cvf1c-r1');
    const zones = [{ name: 'Pelouse', kind: 'ENTREE' as const, admits: [FREE, PAID], gates: ['Porte Nord', 'Porte Sud'] }];
    Z = await createZonedEvent(P, 'cvf1c-r1-z', CATS, zones, { startsInHours: 48 });
    Z2 = await createZonedEvent(P, 'cvf1c-r1-z2', CATS, zones, { startsInHours: 48 });
    north = Z.zones['Pelouse'].gates['Porte Nord'];
    c = await newController(P, Z.eventId, { label: 'cvf1c-r1' });
    const r = await api('PATCH', 'partner/team/settings', { token: P.accessToken, body: { eventId: Z.eventId, controllerId: c.userId, gateId: north, canAcceptCash: false } });
    assert.equal(r.status, 200, `porte Nord (montage) : ${show(r)}`);
});

after(async () => {
    await assertFinition1Invariants('cvf1c-r1-porte-supprimee');
});

async function ephemeralGate(name: string): Promise<string> {
    const { data, error } = await service.from('event_gates').insert({ event_id: Z.eventId, zone_id: Z.zones['Pelouse'].id, name }).select('id').single();
    assert.equal(error, null, `porte ${name} (montage) : ${error?.message}`);
    return String(data!.id);
}

function save(gateId: string): Promise<Reply> {
    return api('PATCH', 'partner/team/settings', { token: P.accessToken, body: { eventId: Z.eventId, controllerId: c.userId, gateId, canAcceptCash: false } });
}

async function assertGateKept(what: string): Promise<void> {
    const a = await assignmentOf(Z.eventId, c.userId);
    assert.equal(a?.gate_id, north, `${what} : porte du contrôleur modifiée (${String(a?.gate_id)})`);
}

describe('R1. porte supprimée', () => {
    test('a. pendant l’enregistrement : refus « n’existe plus », pas d’erreur 500', async () => {
        const gate = await ephemeralGate('Porte Fugace');
        const tx = await openConcurrentClient({ applicationName: 'cvf1c-r1-suppression' });
        let reply: Reply;
        try {
            await tx.query('DELETE FROM public.event_gates WHERE id = $1', [gate]);
            const pending = save(gate);
            try {
                await waitForLockWaiters({ queryLike: '%event_controller_settings_set%' }, 8_000);
            } catch (err) {
                console.log(`[CVF1C-R1] aucune attente de verrou observée (${err instanceof Error ? err.message.slice(0, 160) : String(err)})`);
            }
            await tx.commit();
            reply = await pending;
        } finally {
            await tx.close();
        }
        console.log(`[CVF1C-R1] porte supprimée pendant l'enregistrement → ${show(reply)}`);
        assert.equal(reply.status, 409, `statut : ${show(reply)}`);
        assert.equal(reply.body.code, 'GATE_GONE', show(reply));
        assert.equal(reply.body.error, GATE_GONE_TEXT, show(reply));
        await assertGateKept('pendant');
    });

    test('b. avant l’enregistrement : même refus', async () => {
        const gate = await ephemeralGate('Porte Disparue');
        const { error } = await service.from('event_gates').delete().eq('id', gate);
        assert.equal(error, null, `suppression (montage) : ${error?.message}`);
        const reply = await save(gate);
        assert.equal(reply.status, 409, `statut : ${show(reply)}`);
        assert.equal(reply.body.code, 'GATE_GONE', show(reply));
        assert.equal(reply.body.error, GATE_GONE_TEXT, show(reply));
        await assertGateKept('avant');
    });

    test('c. porte d’un autre événement : « Porte inconnue », inchangé', async () => {
        const reply = await save(Z2.zones['Pelouse'].gates['Porte Sud']);
        assert.equal(reply.status, 409, `statut : ${show(reply)}`);
        assert.equal(reply.body.code, 'GATE_INVALID', show(reply));
        await assertGateKept('autre événement');
    });
});
