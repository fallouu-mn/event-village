/**
 * Lot 1A.3 (R3) — aucune RPC métier n'est appelable avec la clé anon ou un compte gratuit.
 * Les aides RLS (liste blanche) restent appelables : sinon toute la RLS casse.
 * Lot 7 (T0d) : fonctions nouvelles du lot (M2, M4, M5) ajoutées, et contrôlées comme celles du lot 6
 * (elles doivent EXISTER et être refusées par le privilège EXECUTE, 42501) ; 7e aide RLS
 * ticket_category_private_read (D21). Rouges jusqu'aux migrations 20261105000002 à …05.
 * Lot 7, tâche 7.9 (T31) : notif_ticket_lines (migration 20261105000007), même contrôle ; rouge jusqu'à fix(7.9).
 * Lot 8 (T3) : fonctions nouvelles du lot, même contrôle (42501, jamais PGRST202) ; rouges chacune jusqu'à sa
 * migration : fix(8.0s), fix(8.1s), fix(8.2a), fix(8.2l).
 * Lot 9 (T2, T3) : fonctions nouvelles du lot, même contrôle strict ; rouges chacune jusqu'à sa migration
 * (M1 fix(9.3-A33), M2 fix(9.0s), M3 fix(9.1s), M4 fix(9.2s)). ticket_cash_checkin retirée (A16, supprimée par M5).
 * Lot 9 bis (T2, contrat 3.2) : fonctions nouvelles du lot, même contrôle strict (42501, jamais PGRST202) ; rouges
 * chacune jusqu'à sa migration (20261109000004 à …12). Ajout seul : aucune entrée existante ne change.
 * Lot 9 ter (contrat 8.4, K10) : bloc LOT9TER_RPCS, fonctions nouvelles du lot (F5, F6, F7, F12, F17, F21, F22, F27 à F33,
 * F40 à F43), même contrôle strict (42501 pour anon et pour un compte, jamais PGRST202) ; rouges chacune jusqu'à sa
 * migration (20261110000002, …05 à …10). Hors liste : is_admin() et is_superadmin() (aides RLS du groupe a, recopiées
 * par 01, toujours exécutables : bloc des aides RLS ci-dessous), fonctions de trigger, recopies. Ajout seul.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { anonClient, assertDenied, signInFixture, ZERO_UUID } from './helpers';

/**
 * Lot 6 (contrat S1) : RPC et fonctions internes du lot, signature `(p jsonb)` (Conventions), sauf
 * event_start_at(p_event uuid) (contrat D).
 */
function lot6Rpcs(): Array<[string, Record<string, unknown>]> {
    return [...LOT6_JSONB_RPCS.map((fn): [string, Record<string, unknown>] => [fn, { p: {} }]), ['event_start_at', { p_event: ZERO_UUID }]];
}

/** Lot 6 : fonctions `(p jsonb)` créées par le lot ; chacune doit EXISTER et être refusée (42501). */
const LOT6_JSONB_RPCS = [
    'notification_outbox_claim',
    'notification_outbox_mark',
    'notification_daily_checks',
    'notification_reminders_schedule',
    'notification_sync_log',
    'notification_admin_alert',
    'notification_preferences_get',
    'notification_preference_set',
    'notification_test_push_enqueue',
    'notification_controller_activated',
    'notification_retry',
    'notifications_page',
    'notifications_mark_read',
    'admin_notifications_list',
    'admin_notification_detail',
    'admin_notifications_stats',
    'ticket_transfers_incoming',
    'ticket_transfer_accept',
    'partner_status_set',
    'notif_enqueue',
    'notif_enqueue_admins',
    'notif_upsert_aggregated_sms',
] as const;

/**
 * Lot 7 (contrat M2, M4, M5) : fonctions créées par le lot, avec des arguments factices valides en type
 * (signature `(p jsonb)` sauf notif_sms_optional_used(p_day date) et ticket_offline_window(p_event uuid)).
 * Les triggers (trg_tickets_secret_*) ne sont pas des RPC : leur privilège est contrôlé par
 * tests/schema/fonctions-privileges.test.ts (groupe c).
 */
const LOT7_RPCS: Array<[string, Record<string, unknown>]> = [
    ['notif_sms_optional_used', { p_day: '2030-01-01' }],
    ['ticket_secret_rotate', { p: {} }],
    ['ticket_offline_window', { p_event: ZERO_UUID }],
    ['ticket_offline_grant', { p: {} }],
    ['ticket_offline_info', { p: {} }],
    ['controller_scan_stats', { p: {} }],
    ['ticket_manual_lookup', { p: {} }],
    ['counter_sale_quote', { p: {} }],
    // Tâche 7.9 (T31, migration 20261105000007, contrat 19.3) : lignes de billets figées dans la confirmation
    ['notif_ticket_lines', { p_ticket_ids: [ZERO_UUID] }],
];

/**
 * Lot 8 (contrat 2.2, 2.5) : fonctions créées par le lot, avec des arguments factices valides en type.
 * Les noms de paramètres font partie du contrat : ticket_counter_channel_problems(p_event uuid, p_items jsonb)
 * (M1), payment_duplicate_of(p_payment_id uuid) (M3), partner_profile_update(p jsonb) (M6),
 * ev_request_simulated() (M2). Les fonctions de triggers ne sont pas des RPC : leur privilège est contrôlé par
 * tests/schema/fonctions-privileges.test.ts (groupe c).
 */
const LOT8_RPCS: Array<[string, Record<string, unknown>]> = [
    ['ticket_counter_channel_problems', { p_event: ZERO_UUID, p_items: [] }],
    ['ev_request_simulated', {}],
    ['payment_duplicate_of', { p_payment_id: ZERO_UUID }],
    ['partner_profile_update', { p: {} }],
];

/**
 * Lot 9 (contrat 3.2, T2) : fonctions créées par le lot, avec des arguments factices valides en type
 * (signature `(p jsonb)` sauf events_popular(p_limit integer)). Les fonctions de triggers ne sont pas des RPC :
 * leur privilège est contrôlé par tests/schema/fonctions-privileges.test.ts (groupe c).
 */
const LOT9_RPCS: Array<[string, Record<string, unknown>]> = [
    ['ticket_invitation_create', { p: {} }],
    ['ticket_invitation_cancel', { p: {} }],
    ['ticket_invitations_list', { p: {} }],
    ['account_profile_finalize', { p: {} }],
    ['account_phone_finalize', { p: {} }],
    ['account_identity_taken', { p_user_id: ZERO_UUID, p_email: 'absent@example.invalid', p_phone: '221770000000' }],
    ['account_avatar_set', { p: {} }],
    ['client_payments_list', { p: {} }],
    ['admin_permissions_set', { p: {} }],
    ['partner_register_finalize', { p: {} }],
    ['events_popular', { p_limit: 10 }],
];

/**
 * Lot 9 bis (contrat 3.2, T2) : fonctions créées par le lot, avec des arguments factices valides en type. Les noms
 * de paramètres font partie du contrat (PostgREST appelle par nom) : admin_can(p_actor uuid, p_permission text),
 * event_actor_profile_perm(p_event uuid, p_actor uuid, p_permission text) (M04) ; cashout_fee_apply(p_cashout_id
 * uuid) (M05) ; fin_frozen_amount(p_owner uuid, p_kind text, p_at timestamptz), fin_withdrawal_check(p_user uuid,
 * p_kind text, p_gross numeric, p_at timestamptz), ticket_postponement_refund_open(p_ticket uuid) (M06) ;
 * cashouts_to_resume(), cashouts_flag_delayed(), referral_commissions_realign(p_event uuid DEFAULT NULL) (M07) ;
 * event_end_from_v2(p_start_date date, p_start_time time, p_end_date date, p_end_time time),
 * ticket_transfers_expire_due(p_ticket uuid, p_skip_locked boolean) (M08) ; notif_verified_email(p_user uuid) (M10) ;
 * quota_release(p_rules jsonb) (M11) ; les autres `(p jsonb)`. Les fonctions de triggers
 * (ticket_categories_min_price_guard, events_referral_realign, notif_events_admin_change_alert,
 * notif_ticket_categories_admin_alert, notif_controller_shifts_report_ready) ne sont pas des RPC : leur privilège est
 * contrôlé par tests/schema/fonctions-privileges.test.ts (groupe c).
 */
const LOT9BIS_RPCS: Array<[string, Record<string, unknown>]> = [
    // M04 : droits
    ['admin_can', { p_actor: ZERO_UUID, p_permission: 'events.read' }],
    ['event_actor_profile_perm', { p_event: ZERO_UUID, p_actor: ZERO_UUID, p_permission: 'events.read' }],
    ['admin_user_status_set', { p: {} }],
    ['partner_dossier_resubmit', { p: {} }],
    // M05 : SamirPay
    ['cashout_fee_apply', { p_cashout_id: ZERO_UUID }],
    // M06 : argent
    ['fin_frozen_amount', { p_owner: ZERO_UUID, p_kind: 'ORGANISATEUR', p_at: '2030-01-01T00:00:00Z' }],
    ['fin_withdrawal_check', { p_user: ZERO_UUID, p_kind: 'ORGANISATEUR', p_gross: 1000, p_at: '2030-01-01T00:00:00Z' }],
    ['withdrawal_quote', { p: {} }],
    ['ticket_postponement_refund_open', { p_ticket: ZERO_UUID }],
    ['tickets_postponement_offers', { p: {} }],
    ['event_cash_refunds', { p: {} }],
    ['event_cash_refund_mark', { p: {} }],
    // M07 : versements
    ['cashouts_to_resume', {}],
    ['cashouts_flag_delayed', {}],
    ['cashout_admin_decide', { p: {} }],
    ['referral_commissions_realign', { p_event: ZERO_UUID }],
    // M08 : cycle
    ['event_end_from_v2', { p_start_date: '2030-01-01', p_start_time: '20:00', p_end_date: null, p_end_time: null }],
    ['scan_states', { p: {} }],
    ['ticket_card_states', { p: {} }],
    ['ticket_transfers_expire_due', { p_ticket: ZERO_UUID, p_skip_locked: false }],
    ['ticket_transfer_decline', { p: {} }],
    ['controller_invitation_create', { p: {} }],
    ['controller_invitation_respond', { p: {} }],
    ['controller_invitations_mine', { p: {} }],
    ['controller_account_states', { p: {} }],
    ['controller_assignments_sync', { p: {} }],
    // M10 : email
    ['notif_verified_email', { p_user: ZERO_UUID }],
    ['email_verification_issue', { p: {} }],
    ['email_verification_log', { p: {} }],
    ['email_verification_check', { p: {} }],
    ['email_verification_finalize', { p: {} }],
    // M11 : textes
    ['quota_release', { p_rules: [] }],
    ['account_password_finalize', { p: {} }],
    // M12 : mode réel
    ['notification_demo_recipients', { p: {} }],
    ['essai_check_reel', { p: {} }],
];

/**
 * Lot 9 ter (contrat 3.4, 8.4) : fonctions créées par le lot, avec des arguments factices valides en type. Les noms de
 * paramètres font partie du contrat (PostgREST appelle par nom) : ticket_origin(p_channel text, p_price numeric,
 * p_offline_paid boolean), scan_is_refusal(p_accepted boolean, p_result text, p_zone_result text, p_consumed_at
 * timestamptz) (02) ; cashout_admin_not_sent(p jsonb) (05) ; partner_controller_known(p_partner uuid, p_user uuid) (06) ;
 * event_edit_locks(p_event uuid) (07) ; ticket_guest_list_search(p jsonb), ticket_invitation_guest_name_set(p jsonb)
 * (08) ; scan_gate_context(p_scanner uuid, p_event uuid, p_claimed uuid, p_claimed_given boolean),
 * scan_zone_verdict(p_event uuid, p_zone uuid, p_kind text, p_category uuid, p_status text), scan_log_at (14 arguments
 * nommés, sans DEFAULT, F29), event_zones_get, event_zones_save, event_controller_gate_set, controller_gate_select
 * (p jsonb) (09) ; ticket_origin_label(p_origin text), scan_alert_refusal(p_result text, p_zone_result text),
 * scan_refusal_alert_settings() (paramètres OUT seuls), pilotage_compute_entries(p_event uuid, p_with_names boolean)
 * (10). Les fonctions de triggers (partner_controllers_link, notif_event_status_admin_alert,
 * notif_ticket_categories_admin_update_alert, zone_categories_default_admit, scan_refusal_alert) ne sont pas des RPC.
 */
const LOT9TER_RPCS: Array<[string, Record<string, unknown>]> = [
    // 02 : réglages et aides pures
    ['ticket_origin', { p_channel: 'ONLINE', p_price: 0, p_offline_paid: false }],
    ['scan_is_refusal', { p_accepted: false, p_result: 'invalid', p_zone_result: null, p_consumed_at: null }],
    // 05 : argent
    ['cashout_admin_not_sent', { p: {} }],
    // 06 : équipe
    ['partner_controller_known', { p_partner: ZERO_UUID, p_user: ZERO_UUID }],
    // 07 : événements
    ['event_edit_locks', { p_event: ZERO_UUID }],
    // 08 : invités
    ['ticket_guest_list_search', { p: {} }],
    ['ticket_invitation_guest_name_set', { p: {} }],
    // 09 : zones et portes
    ['scan_gate_context', { p_scanner: ZERO_UUID, p_event: ZERO_UUID, p_claimed: null, p_claimed_given: false }],
    ['scan_zone_verdict', { p_event: ZERO_UUID, p_zone: ZERO_UUID, p_kind: 'ENTREE', p_category: ZERO_UUID, p_status: 'VALIDE' }],
    ['scan_log_at', {
        p_ticket: ZERO_UUID, p_event: ZERO_UUID, p_scanner: ZERO_UUID, p_result: 'invalid', p_zone_result: null, p_accepted: false,
        p_method: 'QR', p_identity: false, p_hash: null, p_amount: null, p_secret_version: null, p_client_key: null, p_gate: null, p_zone: null,
    }],
    ['event_zones_get', { p: {} }],
    ['event_zones_save', { p: {} }],
    ['event_controller_gate_set', { p: {} }],
    ['controller_gate_select', { p: {} }],
    // 10 : pilotage
    ['ticket_origin_label', { p_origin: 'ONLINE' }],
    ['scan_alert_refusal', { p_result: 'invalid', p_zone_result: null }],
    ['scan_refusal_alert_settings', {}],
    ['pilotage_compute_entries', { p_event: ZERO_UUID, p_with_names: false }],
];

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
    // Lot 6 : event_notify supprimée (notifications par la boîte d'envoi, contrat J1)
    // Lot 5 (5.5, 5.6, 5.9) : édition, catégories de billets, file des notifications de changement, service_role uniquement
    ['event_create', { p: {} }],
    ['event_update', { p: {} }],
    ['ticket_category_create', { p: {} }],
    ['ticket_category_update', { p: {} }],
    ['ticket_category_delete', { p: {} }],
    // Lot 6 : event_change_notifications_claim et _mark supprimées (file absorbée par la boîte d'envoi, contrat J1.9)
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
    // Lot 6 : notifications (boîte d'envoi, envoyeur, rappels, préférences, cloche, supervision,
    // transferts sans jeton, statut des partenaires), service_role uniquement
    ...lot6Rpcs(),
    // Lot 7 : budget SMS optionnel, billet hors ligne, rotation du secret, scanner, guichet ; service_role uniquement
    ...LOT7_RPCS,
    // Lot 8 : canaux de vente, marquage simulé, double paiement, profil partenaire ; service_role uniquement
    ...LOT8_RPCS,
    // Lot 9 : invitations, compte client, sécurité (A33), populaires ; service_role uniquement
    ...LOT9_RPCS,
    // Lot 9 bis : argent, versements, droits, cycle, email, textes, mode réel ; service_role uniquement
    ...LOT9BIS_RPCS,
    // Lot 9 ter : réglages, argent, équipe, événements, invités, zones, pilotage ; service_role uniquement
    ...LOT9TER_RPCS,
];

/** Aides RLS (groupe a) : doivent rester exécutables par anon et authenticated. */
const RLS_HELPERS: Array<[string, Record<string, unknown> | undefined]> = [
    ['is_admin', undefined],
    ['is_superadmin', undefined],
    ['is_controller', undefined],
    ['has_role', { p_role: 'CLIENT' }],
    ['is_partner_owner', { p_partner_id: ZERO_UUID }],
    ['auth_user_role', undefined],
    // Lot 7 (D21) : prédicat privé des catégories de billets, sans lecture de public.users par l'appelant
    ['ticket_category_private_read', { p_event: ZERO_UUID }],
    // Lot 9 quinquies, contre-vérification (point 4 ; ajout signalé) : affectation de contrôleur active de l'appelant
    ['controller_assignment_active', { p_event: ZERO_UUID }],
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

/**
 * Lot 6, plus strict que la boucle ci-dessus : une fonction absente (PGRST202) y passerait pour refusée.
 * Ici, chaque RPC `(p jsonb)` du lot doit exister ET être refusée par le privilège EXECUTE (42501).
 */
describe('R3 — lot 6 : chaque RPC du lot existe et reste réservée au rôle de service (42501)', () => {
    function assertPrivilegeDenied(error: { code?: string; message?: string } | null, what: string): void {
        assert.ok(error, `${what} : appel accepté, la fonction doit être réservée au rôle de service`);
        assert.ok(error.code === '42501' || /permission denied/i.test(error.message ?? ''),
            `${what} : refus attendu par le privilège EXECUTE (42501), obtenu ${error.code} ${error.message} — ` +
            'PGRST202 : fonction absente ou signature différente de `(p jsonb)`');
    }
    for (const fn of LOT6_JSONB_RPCS) {
        test(`anon et authenticated (compte CLIENT) : rpc(${fn}) existe et est refusée`, async () => {
            const anon = await anonClient().rpc(fn, { p: {} });
            assertPrivilegeDenied(anon.error, `anon rpc(${fn})`);
            const { client } = await signInFixture('CLIENT_BIS');
            const auth = await client.rpc(fn, { p: {} });
            assertPrivilegeDenied(auth.error, `authenticated rpc(${fn})`);
        });
    }
});

/**
 * Lot 7, même exigence que le lot 6 : une fonction absente (PGRST202) passerait pour refusée dans la boucle
 * générale ; ici chaque fonction du lot doit exister ET être refusée par le privilège EXECUTE (42501).
 */
describe('R3 — lot 7 : chaque fonction du lot existe et reste réservée au rôle de service (42501)', () => {
    for (const [fn, args] of LOT7_RPCS) {
        test(`anon et authenticated (compte CLIENT) : rpc(${fn}) existe et est refusée`, async () => {
            const anon = await anonClient().rpc(fn, args);
            assert.ok(anon.error, `anon rpc(${fn}) : appel accepté, la fonction doit être réservée au rôle de service`);
            assert.ok(anon.error.code === '42501' || /permission denied/i.test(anon.error.message ?? ''),
                `anon rpc(${fn}) : refus attendu par le privilège EXECUTE (42501), obtenu ${anon.error.code} ${anon.error.message} — PGRST202 : fonction absente (migrations 20261105000002 à …05, …07 pour notif_ticket_lines) ou signature différente`);
            const { client } = await signInFixture('CLIENT_BIS');
            const auth = await client.rpc(fn, args);
            assert.ok(auth.error, `authenticated rpc(${fn}) : appel accepté, la fonction doit être réservée au rôle de service`);
            assert.ok(auth.error.code === '42501' || /permission denied/i.test(auth.error.message ?? ''),
                `authenticated rpc(${fn}) : refus attendu par le privilège EXECUTE (42501), obtenu ${auth.error.code} ${auth.error.message} — PGRST202 : fonction absente (migrations 20261105000002 à …05, …07 pour notif_ticket_lines) ou signature différente`);
        });
    }
});

/**
 * Lot 8, même exigence que les lots 6 et 7 : une fonction absente (PGRST202) passerait pour refusée dans la
 * boucle générale ; ici chaque fonction du lot doit exister ET être refusée par le privilège EXECUTE (42501).
 */
describe('R3 — lot 8 : chaque fonction du lot existe et reste réservée au rôle de service (42501)', () => {
    const MIGRATIONS = 'migrations 20261106000001 (canaux), …02 (essai), …03 (paiement), …06 (profil)';
    for (const [fn, args] of LOT8_RPCS) {
        test(`anon et authenticated (compte CLIENT) : rpc(${fn}) existe et est refusée`, async () => {
            const anon = await anonClient().rpc(fn, args);
            assert.ok(anon.error, `anon rpc(${fn}) : appel accepté, la fonction doit être réservée au rôle de service`);
            assert.ok(anon.error.code === '42501' || /permission denied/i.test(anon.error.message ?? ''),
                `anon rpc(${fn}) : refus attendu par le privilège EXECUTE (42501), obtenu ${anon.error.code} ${anon.error.message} — PGRST202 : fonction absente (${MIGRATIONS}) ou signature différente`);
            const { client } = await signInFixture('CLIENT_BIS');
            const auth = await client.rpc(fn, args);
            assert.ok(auth.error, `authenticated rpc(${fn}) : appel accepté, la fonction doit être réservée au rôle de service`);
            assert.ok(auth.error.code === '42501' || /permission denied/i.test(auth.error.message ?? ''),
                `authenticated rpc(${fn}) : refus attendu par le privilège EXECUTE (42501), obtenu ${auth.error.code} ${auth.error.message} — PGRST202 : fonction absente (${MIGRATIONS}) ou signature différente`);
        });
    }
});

/**
 * Lot 9, même exigence que les lots 6 à 8 : une fonction absente (PGRST202) passerait pour refusée dans la boucle
 * générale ; ici chaque fonction du lot doit exister ET être refusée par le privilège EXECUTE (42501).
 */
describe('R3 — lot 9 : chaque fonction du lot existe et reste réservée au rôle de service (42501)', () => {
    const MIGRATIONS = 'migrations 20261108000001 (sécurité), …02 (invitations), …03 (découverte), …04 (compte)';
    for (const [fn, args] of LOT9_RPCS) {
        test(`anon et authenticated (compte CLIENT) : rpc(${fn}) existe et est refusée`, async () => {
            const anon = await anonClient().rpc(fn, args);
            assert.ok(anon.error, `anon rpc(${fn}) : appel accepté, la fonction doit être réservée au rôle de service`);
            assert.ok(anon.error.code === '42501' || /permission denied/i.test(anon.error.message ?? ''),
                `anon rpc(${fn}) : refus attendu par le privilège EXECUTE (42501), obtenu ${anon.error.code} ${anon.error.message} — PGRST202 : fonction absente (${MIGRATIONS}) ou signature différente`);
            const { client } = await signInFixture('CLIENT_BIS');
            const auth = await client.rpc(fn, args);
            assert.ok(auth.error, `authenticated rpc(${fn}) : appel accepté, la fonction doit être réservée au rôle de service`);
            assert.ok(auth.error.code === '42501' || /permission denied/i.test(auth.error.message ?? ''),
                `authenticated rpc(${fn}) : refus attendu par le privilège EXECUTE (42501), obtenu ${auth.error.code} ${auth.error.message} — PGRST202 : fonction absente (${MIGRATIONS}) ou signature différente`);
        });
    }
});

/**
 * Lot 9 bis, même exigence que les lots 6 à 9 : une fonction absente (PGRST202) passerait pour refusée dans la boucle
 * générale ; ici chaque fonction du lot doit exister ET être refusée par le privilège EXECUTE (42501).
 */
describe('R3 — lot 9 bis : chaque fonction du lot existe et reste réservée au rôle de service (42501)', () => {
    const MIGRATIONS = 'migrations 20261109000004 (droits), …05 (SamirPay), …06 (argent), …07 (versements), …08 (cycle), …10 (email), …11 (textes), …12 (mode réel)';
    for (const [fn, args] of LOT9BIS_RPCS) {
        test(`anon et authenticated (compte CLIENT) : rpc(${fn}) existe et est refusée`, async () => {
            const anon = await anonClient().rpc(fn, args);
            assert.ok(anon.error, `anon rpc(${fn}) : appel accepté, la fonction doit être réservée au rôle de service`);
            assert.ok(anon.error.code === '42501' || /permission denied/i.test(anon.error.message ?? ''),
                `anon rpc(${fn}) : refus attendu par le privilège EXECUTE (42501), obtenu ${anon.error.code} ${anon.error.message} — PGRST202 : fonction absente (${MIGRATIONS}) ou signature différente`);
            const { client } = await signInFixture('CLIENT_BIS');
            const auth = await client.rpc(fn, args);
            assert.ok(auth.error, `authenticated rpc(${fn}) : appel accepté, la fonction doit être réservée au rôle de service`);
            assert.ok(auth.error.code === '42501' || /permission denied/i.test(auth.error.message ?? ''),
                `authenticated rpc(${fn}) : refus attendu par le privilège EXECUTE (42501), obtenu ${auth.error.code} ${auth.error.message} — PGRST202 : fonction absente (${MIGRATIONS}) ou signature différente`);
        });
    }
});

/**
 * Lot 9 ter (contrat 8.4), même exigence que les lots 6 à 9 bis : une fonction absente (PGRST202) passerait pour
 * refusée dans la boucle générale ; ici chaque fonction du lot doit exister ET être refusée par le privilège EXECUTE
 * (42501), pour anon et pour un compte.
 */
describe('R3 — lot 9 ter : chaque fonction du lot existe et reste réservée au rôle de service (42501)', () => {
    const MIGRATIONS = 'migrations 20261110000002 (réglages), …05 (argent), …06 (équipe), …07 (événements), …08 (invités), …09 (zones), …10 (pilotage)';
    for (const [fn, args] of LOT9TER_RPCS) {
        test(`anon et authenticated (compte CLIENT) : rpc(${fn}) existe et est refusée`, async () => {
            const anon = await anonClient().rpc(fn, args);
            assert.ok(anon.error, `anon rpc(${fn}) : appel accepté, la fonction doit être réservée au rôle de service`);
            assert.ok(anon.error.code === '42501' || /permission denied/i.test(anon.error.message ?? ''),
                `anon rpc(${fn}) : refus attendu par le privilège EXECUTE (42501), obtenu ${anon.error.code} ${anon.error.message} — PGRST202 : fonction absente (${MIGRATIONS}) ou signature différente`);
            const { client } = await signInFixture('CLIENT_BIS');
            const auth = await client.rpc(fn, args);
            assert.ok(auth.error, `authenticated rpc(${fn}) : appel accepté, la fonction doit être réservée au rôle de service`);
            assert.ok(auth.error.code === '42501' || /permission denied/i.test(auth.error.message ?? ''),
                `authenticated rpc(${fn}) : refus attendu par le privilège EXECUTE (42501), obtenu ${auth.error.code} ${auth.error.message} — PGRST202 : fonction absente (${MIGRATIONS}) ou signature différente`);
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
