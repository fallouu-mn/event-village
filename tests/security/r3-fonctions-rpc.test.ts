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
    // Lot 3 : request_withdrawal supprimée, remplacée par withdrawal_request (plus bas)
    // Lot 4 : atomic_ticket_checkin supprimée, remplacée par ticket_scan (plus bas)
    ['atomic_partner_remove_controller', { p_partner_id: ZERO_UUID, p_controller_id: ZERO_UUID }],
    ['generate_referral_code', { p_user_id: ZERO_UUID, p_phone: '770000000' }],
    // Lot 2 : chaîne paiement → billet (service_role uniquement)
    ['ticket_sale_problems', { p_event_id: ZERO_UUID, p_items: [] }],
    ['checkout_create_payment', { p: {} }],
    ['payment_release', { p_payment_id: ZERO_UUID, p_status: 'FAILED', p_reason: 'TEST' }],
    ['stock_reservations_expire', {}],
    ['refund_request', { p_payment_id: ZERO_UUID, p_reason: 'TEST', p_kind: 'REFUND' }],
    ['payment_confirm', { p_payment_id: ZERO_UUID, p_source: 'TEST' }],
    ['free_tickets_claim', { p_user_id: ZERO_UUID, p_event_id: ZERO_UUID, p_items: [] }],
    ['payment_webhook_record', { p_dedupe_key: '0'.repeat(64), p_raw_body: '', p_headers: {}, p_token_present: false, p_order_id: null, p_transaction_id: null }],
    // Lot 3 : finance (service_role uniquement)
    ['finance_setting_set', { p_key: 'finance.service_fee_rate', p_value: { value: 0 }, p_actor: ZERO_UUID, p_reason: 'TEST' }],
    ['fin_setting', { p_key: 'finance.service_fee_rate' }],
    ['finance_compute', { p_target: 'TICKET', p_lines: [{ unit_price: 1000, quantity: 1 }], p_operator: 'WAVE' }],
    ['finance_quote', { p_event_id: ZERO_UUID, p_items: [], p_operator: null }],
    ['finance_account_balance', { p_owner: ZERO_UUID, p_kind: 'PARRAINAGE' }],
    ['ticket_refund_request', { p_ticket_id: ZERO_UUID, p_actor: ZERO_UUID, p_reason: 'TEST' }],
    ['cashout_finalize', { p_cashout_id: ZERO_UUID, p_outcome: 'CONFIRME', p_detail: 'TEST' }],
    ['withdrawal_request', { p: {} }],
    ['referral_commissions_release', {}],
    ['finance_partner_summary', { p_partner_id: ZERO_UUID, p_event_id: null }],
    ['finance_platform_revenue', { p_from: null, p_to: null }],
    // Lot 4 : contrôle d'accès et caisse (service_role uniquement)
    ['ticket_scan', { p: {} }],
    ['ticket_cash_checkin', { p: {} }],
    ['counter_sale', { p: {} }],
    ['shift_open', { p: {} }],
    ['ticket_transfer_claim', { p_transfer_id: ZERO_UUID, p_recipient: ZERO_UUID }],
    ['scan_scanner_authorized', { p_scanner: ZERO_UUID, p_event: ZERO_UUID }],
    ['scan_event_problem', { p_event: ZERO_UUID }],
    // Lot 5 (5.0) : dette du lot 4, service_role uniquement
    ['try_uuid', { p_value: ZERO_UUID }],
    ['ticket_transfer_initiate', { p: {} }],
    ['ticket_transfer_cancel', { p: {} }],
    ['ticket_transfers_expire', { p: {} }],
    ['shift_close', { p: {} }],
    ['user_roles_set', { p: {} }],
    ['otp_check', { p: {} }],
    ['scan_incident_log', { p: {} }],
    // Lot 5 (5.2, 5.4, 5.8) : cycle de vie de l'événement, service_role uniquement
    ['event_transition', { p: {} }],
    ['event_actions', { p: {} }],
    ['event_cancel', { p: {} }],
    ['event_cancellation_impact', { p: {} }],
    ['event_cancellation_progress', { p: {} }],
    ['events_finish_overdue', { p: {} }],
    ['event_end_at', { p_event_id: ZERO_UUID }],
    ['event_status_label', { p_status: 'PUBLIE' }],
    ['event_actor_profile', { p_event: ZERO_UUID, p_actor: ZERO_UUID }],
    ['event_status_apply', { p_event: ZERO_UUID, p_from: 'PUBLIE', p_to: 'TERMINE', p_actor: null, p_role: 'SYSTEM', p_reason: null, p_channel: 'CRON' }],
    ['event_notify', { p_users: [], p_title: 'TEST', p_content: 'TEST', p_metadata: {} }],
    // Lot 5 (5.5, 5.6, 5.9) : édition, catégories de billets, file des notifications de changement, service_role uniquement
    ['event_create', { p: {} }],
    ['event_update', { p: {} }],
    ['ticket_category_create', { p: {} }],
    ['ticket_category_update', { p: {} }],
    ['ticket_category_delete', { p: {} }],
    ['event_change_notifications_claim', { p: {} }],
    ['event_change_notifications_mark', { p: {} }],
    ['event_edit_refusal', { p_code: 'TEST', p_message: 'TEST', p_field: null, p_extra: {} }],
    ['event_end_from', { p_start_date: '2030-01-01', p_end_date: null, p_end_time: null }],
    ['event_poster_path_ok', { p_url: 'https://exemple.invalid/a.png', p_partner: ZERO_UUID }],
    ['ticket_category_has_sales', { p_category: ZERO_UUID }],
    ['event_has_sales', { p_event: ZERO_UUID }],
    ['ticket_category_normalize', { p_cat: {}, p_event_end: null, p_prefix: '' }],
    ['ticket_category_guard', { p_event: ZERO_UUID, p_actor: ZERO_UUID }],
    // Lot 5 (5.13) : temps réel (résumés publics), service_role uniquement
    ['low_stock_threshold', {}],
    ['public_category_stock_sync', { p_category_id: ZERO_UUID }],
    ['public_event_state_sync', { p_event_id: ZERO_UUID }],
    // Lot 5 (5.7, 5.10, 5.11, 5.12) : pilotage, listes partenaire et admin, service_role uniquement
    ['pilotage_scan_result_label', { p_result: 'valid' }],
    ['pilotage_ticket_status_label', { p_status: 'VALIDE' }],
    ['pilotage_display_name', { p_first: 'TEST', p_last: 'TEST' }],
    ['pilotage_access', { p_event: ZERO_UUID, p_actor: ZERO_UUID }],
    ['pilotage_refusal', { p_code: 'EVENT_NOT_FOUND' }],
    ['pilotage_category_stats', { p_event: ZERO_UUID }],
    ['pilotage_compute_overview', { p_event: ZERO_UUID }],
    ['pilotage_compute_cash', { p_event: ZERO_UUID }],
    ['pilotage_overview', { p: {} }],
    ['pilotage_sales', { p: {} }],
    ['pilotage_entries', { p: {} }],
    ['pilotage_team', { p: {} }],
    ['pilotage_cash', { p: {} }],
    ['pilotage_closing', { p: {} }],
    ['participants_export', { p: {} }],
    ['event_controller_set_cash', { p: {} }],
    ['partner_events_overview', { p: {} }],
    ['admin_events_list', { p: {} }],
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
