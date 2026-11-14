/**
 * Lot 9 quinquies, correctifs de la contre-vérification — point 3 : POST /api/auth/send-otp avec l'objet REGISTER (et ses
 * synonymes SIGNUP, INSCRIPTION) refuse, avant tout SMS, un numéro qui a déjà un compte, quel que soit son statut, avec la
 * même réponse que POST /api/auth/register/start.
 *
 * Rouge avant correctif (contre-vérification, run 177, cv9qq-6) : send-otp REGISTER répondait 200 et envoyait un code par
 * SMS au numéro d'un compte suspendu (la garde du compte suspendu excluait REGISTER).
 */
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { getFakes } from '../fakes';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { post } from '../audit-auth/cv9qq-helpers';
import { newBuyer, service } from './paiement-helpers';

after(async () => {
    await assertLot9quinquiesInvariants('lot9quinquies-cv-inscription');
});

describe('Point 3 — send-otp REGISTER : numéro déjà inscrit refusé avant tout SMS', () => {
    for (const status of ['ACTIF', 'SUSPENDU'] as const) {
        test(`compte ${status} : même réponse que register/start, aucun SMS`, async () => {
            const u = await newBuyer(`cv-insc-${status.toLowerCase()}`);
            if (status !== 'ACTIF') {
                const { error } = await service.from('users').update({ status }).eq('id', u.userId);
                assert.equal(error, null, error?.message);
            }
            const before = getFakes().sms.messagesTo(u.phoneE164).length;
            const reference = await post('auth/register/start', { phone: u.phoneE164 });
            const replies: string[] = [];
            for (const purpose of ['REGISTER', 'SIGNUP', 'INSCRIPTION']) {
                const r = await post('auth/send-otp', { phone: u.phoneE164, purpose });
                replies.push(`${purpose}:${r.status}/${String(r.body.code ?? '')}`);
                assert.deepEqual([r.status, r.body.code, r.body.error], [reference.status, reference.body.code, reference.body.error],
                    `send-otp ${purpose} : ${JSON.stringify(r.body)} ; register/start : ${JSON.stringify(reference.body)}`);
            }
            const sms = getFakes().sms.messagesTo(u.phoneE164).slice(before).map((m) => m.message);
            console.log(`[CV-3] compte ${status} : register/start ${reference.status}/${String(reference.body.code)} ; send-otp ${replies.join(' ')} ; SMS ${sms.length}`);
            assert.deepEqual([reference.status, reference.body.code], [409, 'PHONE_ALREADY_REGISTERED']);
            assert.deepEqual(sms, [], 'aucun SMS vers un numéro déjà inscrit');
        });
    }
});
