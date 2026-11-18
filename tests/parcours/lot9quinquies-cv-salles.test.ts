/**
 * Lot 9 quinquies, correctifs de la contre-vérification — point 5 : réservations de salle simultanées sans blocage mutuel.
 *
 * Constat (run 177, tests/partner-halls-m7.test.ts, test 2) : deux réservations simultanées sur des dates qui se
 * chevauchent, l'une refusée par « deadlock detected » au lieu du refus de conflit de calendrier. Cause : la contrainte
 * d'exclusion no_overlapping_hall_reservations (0009) vérifie le conflit APRÈS avoir inséré l'entrée d'index ; deux
 * insertions concurrentes qui se chevauchent se voient l'une l'autre en cours et s'attendent mutuellement (attente sur la
 * transaction de l'autre) : PostgreSQL en annule une (40P01). Le déclencheur check_hall_availability (0002) ne voit pas la
 * ligne non validée de l'autre et ne sérialise rien. Aucun déclencheur sur partners n'intervient (le seul déclencheur de
 * l'insertion, trg_hall_reservations_notify, lit partners et met un avis en file, sans verrou partagé).
 *
 * Preuve : plusieurs tours de réservations simultanées sur une même salle neuve, dates qui se chevauchent : à chaque tour
 * exactement une réussit, les autres reçoivent le refus de conflit de calendrier ; jamais « deadlock detected ».
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { HallService } from '../../lib/halls/hall.service';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { newPartner, superadminId, type TestPartner } from './finance-helpers';
import { platformSetting, setPlatformSetting } from './l10a-helpers';

const ROUNDS = 15;
const CONCURRENT = 4;

let partner: TestPartner;
const clients: Buyer[] = [];

// Lot 10a (modification signalée au rapport) : la réservation passe par hall_reserve : service ouvert le temps de la suite (valeur
// remise ensuite), salle validée par l'administration ; dates relatives (une date à venir est exigée). Assertions
// inchangées (une seule réussite par tour, refus « déjà réservée pour cette période », jamais de blocage mutuel).
let hallsWereOpen: unknown;
function dayFromNow(days: number): string {
    return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

before(async () => {
    hallsWereOpen = await platformSetting('features.halls_enabled');
    await setPlatformSetting('features.halls_enabled', true);
    partner = await newPartner('cv-salles');
    for (let i = 0; i < CONCURRENT; i += 1) clients.push(await newBuyer(`cv-salles-${i}`));
});

after(async () => {
    await setPlatformSetting('features.halls_enabled', hallsWereOpen);
    await assertLot9quinquiesInvariants('lot9quinquies-cv-salles');
});

async function newHall(round: number): Promise<string> {
    const { data, error } = await service.from('halls').insert({
        partner_id: partner.partnerId, name: `Salle contre-vérification ${round} ${Date.now()}`, capacity: 100, price_per_day: 100_000, deposit_percentage: 30,
    }).select('id').single();
    assert.equal(error, null, error?.message);
    const { data: decided, error: decErr } = await service.rpc('hall_validation_decide', { p: { actor_id: await superadminId(), hall_id: data!.id, decision: 'VALIDER' } });
    assert.equal(decErr, null, decErr?.message);
    assert.equal((decided as { ok?: boolean }).ok, true, JSON.stringify(decided));
    return String(data!.id);
}

describe('Point 5 — réservations de salle simultanées', () => {
    test(`${ROUNDS} tours de ${CONCURRENT} réservations simultanées qui se chevauchent : une seule réussit, jamais de blocage mutuel`, async () => {
        const deadlocks: string[] = [];
        const wrong: string[] = [];
        for (let round = 0; round < ROUNDS; round += 1) {
            const hallId = await newHall(round);
            const results = await Promise.allSettled(clients.map((c, i) => HallService.createReservation({
                hallId,
                clientId: c.userId,
                startDate: dayFromNow(120 + i),
                endDate: dayFromNow(125 + i),
                notes: `Contre-vérification, tour ${round}, client ${i}`,
            })));
            const ok = results.filter((r) => r.status === 'fulfilled').length;
            const reasons = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map((r) => String((r.reason as Error)?.message ?? r.reason));
            for (const reason of reasons) {
                if (/deadlock/i.test(reason)) deadlocks.push(`tour ${round} : ${reason}`);
                else if (!reason.includes('déjà réservée pour cette période')) wrong.push(`tour ${round} : ${reason}`);
            }
            const { count } = await service.from('hall_reservations').select('id', { count: 'exact', head: true }).eq('hall_id', hallId);
            if (ok !== 1 || count !== 1) wrong.push(`tour ${round} : ${ok} réussite(s), ${count} ligne(s) en base`);
            // Lot 10a (signalé) : attente du gagnant rendue (au plus 3 réservations non payées par client)
            await service.from('hall_reservations').update({ hold_expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('hall_id', hallId);
        }
        console.log(`[CV-5] ${ROUNDS} tours × ${CONCURRENT} : blocages mutuels ${deadlocks.length} ; autres écarts ${wrong.length}${deadlocks[0] ? ` ; ex. ${deadlocks[0]}` : ''}`);
        assert.deepEqual(deadlocks, [], `blocages mutuels :\n${deadlocks.join('\n')}`);
        assert.deepEqual(wrong, [], `écarts :\n${wrong.join('\n')}`);
    });
});
