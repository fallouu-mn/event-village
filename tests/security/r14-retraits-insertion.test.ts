/**
 * Lot 3 (F) — R14 : un compte connecté ne peut plus écrire directement dans withdrawals par l'API
 * REST. La politique withdrawals_insert (0003_rls.sql, WITH CHECK user_id = auth.uid()) laissait
 * tout compte insérer ses propres retraits, statut compris (PAID, PENDING…) : historique falsifiable,
 * totaux faussés, solde de parrainage réduit par une ligne PENDING forgée. Les retraits ne naissent
 * plus que par la RPC withdrawal_request (service_role).
 * (Clé anon + signUp / signInWithPassword uniquement.)
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import { assertDenied, signUpAttacker, uniqueSuffix } from './helpers';

describe('R14 — insertion directe dans withdrawals refusée', () => {
    for (const status of ['PAID', 'PENDING'] as const) {
        test(`compte connecté : insertion d'un retrait ${status} à son nom → refusée`, async () => {
            const attacker = await signUpAttacker(`r14-${status.toLowerCase()}`);
            const { error } = await attacker.client.from('withdrawals').insert({
                user_id: attacker.userId,
                gross_amount: 5000,
                fee_rate: 1,
                fee_amount: 50,
                net_amount: 4950,
                withdrawal_method: 'MOBILE_MONEY',
                payment_details: { phoneNumber: '771112233', operatorName: 'WAVE', note: `retrait forgé ${uniqueSuffix()}` },
                status,
            });
            assertDenied(error, `INSERT withdrawals (retrait ${status} forgé)`);
        });
    }

    test('compte connecté : appel direct de withdrawal_request → refusé', async () => {
        const attacker = await signUpAttacker('r14-rpc');
        const { error } = await attacker.client.rpc('withdrawal_request', {
            p: { user_id: attacker.userId, account_kind: 'PARRAINAGE', gross_amount: 5000, method: 'MOBILE_MONEY', operator: 'WAVE', phone_number: '771112233', client_key: uniqueSuffix() },
        });
        assertDenied(error, 'rpc(withdrawal_request) par un compte connecté');
    });
});
