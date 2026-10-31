/**
 * Lot 1A.3 (R3) — aucune RPC métier n'est appelable avec la clé anon ou un compte gratuit.
 * Les aides RLS (liste blanche) restent appelables : sinon toute la RLS casse.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { anonClient, assertDenied, signInFixture, ZERO_UUID } from './helpers';

/** RPC métier (groupe b) avec des arguments factices valides en type. */
const BUSINESS_RPCS: Array<[string, Record<string, unknown>]> = [
    ['validate_and_check_in_ticket', { p_qr_code: 'EV-QR-INEXISTANT', p_controller_id: ZERO_UUID }],
    ['calculate_referral_commissions', { p_payment_id: ZERO_UUID }],
    ['activate_partner_trial', { p_partner_id: ZERO_UUID }],
    ['has_admin_permission', { p_user_id: ZERO_UUID, p_permission: 'users.write' }],
    ['create_hall_reservation_atomic', { p_hall_id: ZERO_UUID, p_client_id: ZERO_UUID, p_start_date: '2030-01-01', p_end_date: '2030-01-02' }],
    ['create_table_reservation_atomic', { p_table_id: ZERO_UUID, p_client_id: ZERO_UUID, p_reservation_date: '2030-01-01', p_reservation_time: '20:00', p_guest_count: 2 }],
    ['request_withdrawal', { p_user_id: ZERO_UUID, p_gross_amount: 5000, p_fee_rate: 1, p_fee_amount: 50, p_net_amount: 4950, p_payment_details: {} }],
    ['atomic_ticket_checkin', { p_ticket_id: ZERO_UUID, p_controller_id: ZERO_UUID }],
    ['atomic_partner_remove_controller', { p_partner_id: ZERO_UUID, p_controller_id: ZERO_UUID }],
    ['generate_referral_code', { p_user_id: ZERO_UUID, p_phone: '770000000' }],
];

/** Aides RLS (groupe a) : doivent rester exécutables par anon et authenticated. */
const RLS_HELPERS: Array<[string, Record<string, unknown> | undefined]> = [
    ['is_admin', undefined],
    ['is_superadmin', undefined],
    ['is_controller', undefined],
    ['has_role', { p_role: 'CLIENT' }],
    ['is_partner_owner', { p_partner_id: ZERO_UUID }],
    ['auth_user_role', undefined],
];

describe('R3 — RPC métier non appelables par anon / authenticated', () => {
    for (const [fn, args] of BUSINESS_RPCS) {
        test(`anon : rpc(${fn}) refusée`, async () => {
            const { error } = await anonClient().rpc(fn, args);
            assertDenied(error, `anon rpc(${fn})`);
        });
        test(`authenticated (compte CLIENT) : rpc(${fn}) refusée`, async () => {
            const { client } = await signInFixture('CLIENT_BIS');
            const { error } = await client.rpc(fn, args);
            assertDenied(error, `authenticated rpc(${fn})`);
        });
    }
});

describe('R3 — aides RLS toujours appelables (sinon les politiques échouent)', () => {
    for (const [fn, args] of RLS_HELPERS) {
        test(`anon et authenticated : rpc(${fn}) acceptée`, async () => {
            const anon = await anonClient().rpc(fn, args);
            assert.equal(anon.error, null, `anon rpc(${fn}) : ${anon.error?.message}`);
            const { client } = await signInFixture('CLIENT_BIS');
            const auth = await client.rpc(fn, args);
            assert.equal(auth.error, null, `authenticated rpc(${fn}) : ${auth.error?.message}`);
        });
    }
});
