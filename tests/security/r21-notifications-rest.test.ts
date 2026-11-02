/**
 * R21 — Lot 6, tâche 6.1 (contrat C2, C5, F1) : la boîte d'envoi et ses tables ne s'atteignent pas par
 * REST ; un compte ne crée ni ne modifie ses notifications in-app.
 *  - notification_outbox, notification_preferences, push_subscriptions, notification_types : RLS
 *    activée sans politique, `REVOKE ALL … FROM PUBLIC, anon, authenticated` (lecture et écriture par
 *    les routes, en service_role, après requireActiveSession). Ni anon, ni un client, ni un partenaire,
 *    ni un ADMIN connecté (is_admin() vrai) ne lit, n'insère, ne modifie ou ne supprime une ligne : le
 *    refus doit venir du PRIVILÈGE (42501). Une table absente (PGRST205) ne prouverait rien : elle n'est
 *    pas acceptée ici (même règle que le bloc « lot 6 » de r3-fonctions-rpc.test.ts).
 *  - notifications (cloche) : les politiques notifications_insert_admin et notifications_update_own
 *    disparaissent et INSERT, UPDATE, DELETE, TRUNCATE sont révoqués à anon et authenticated
 *    (migration 20261103000007) ; l'écriture passe par notification_outbox_mark seulement. La lecture
 *    de ses propres notifications reste permise (cloche, temps réel).
 *
 * Rouge avant correctif :
 *  - les quatre tables n'existent pas : PostgREST répond PGRST205, refusé ici faute de 42501 ;
 *  - supabase/migrations/0003_rls.sql:345-349 : notifications_update_own (UPDATE USING user_id =
 *    auth.uid()) et notifications_insert_admin (INSERT WITH CHECK is_admin() OR user_id = auth.uid()),
 *    avec les privilèges par défaut de Supabase : un client insère une notification à son nom et
 *    modifie les siennes ; un ADMIN connecté en insère une au nom d'un autre compte.
 * Déjà vert (garde-fous, signalés) : anon n'insère pas de notification (RLS : auth.uid() nul) ; un client
 * ne supprime aucune notification (aucune politique DELETE) ; un client lit les siennes.
 *
 * Les lignes insérées à tort avant correctif portent sur des comptes jetables (signUpAttacker), jamais
 * sur un compte du seed. Pas d'assertNotificationInvariants ici : la règle du lot 1A (clé anon seule,
 * aucun client service_role dans tests/security) prime ; la suite n'écrit rien dans la boîte d'envoi.
 * (Clé anon + signUp / signInWithPassword uniquement.)
 */
import '../helpers/env';
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { anonClient, assertDenied, signInFixture, signUpAttacker, ZERO_UUID, type AttackerAccount } from './helpers';

type Role = 'anon' | 'CLIENT' | 'PARTNER_A' | 'ADMIN';
const ROLES: Role[] = ['anon', 'CLIENT', 'PARTNER_A', 'ADMIN'];

async function clientFor(role: Role): Promise<{ client: SupabaseClient; userId: string | null }> {
    if (role === 'anon') return { client: anonClient(), userId: null };
    const account = await signInFixture(role);
    return { client: account.client, userId: account.userId };
}

/** Refus par le privilège de la table (42501), et non par une table absente ou un filtre vide. */
function assertPrivilegeDenied(error: PostgrestError | null, what: string): void {
    assert.ok(error, `${what} : opération ACCEPTÉE, la table doit être réservée au rôle de service`);
    assert.ok(error.code === '42501' || /permission denied/i.test(error.message),
        `${what} : refus attendu par le privilège (42501), obtenu ${error.code} ${error.message}` +
        (error.code === 'PGRST205' ? ' — PGRST205 : table absente (contrat C2/C5, migration 20261103000002)' : ''));
}

function phone(): string {
    return `+22176${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
}

interface TableCase {
    table: 'notification_outbox' | 'notification_preferences' | 'push_subscriptions' | 'notification_types';
    /** Colonne de filtre existante (UPDATE et DELETE visent une ligne inexistante : seul le privilège répond). */
    filterColumn: string;
    filterValue: string;
    row(userId: string | null): Record<string, unknown>;
    update: Record<string, unknown>;
}

const TABLES: TableCase[] = [
    {
        table: 'notification_outbox', filterColumn: 'id', filterValue: ZERO_UUID,
        row: (userId) => {
            const group = `R21:${randomUUID()}`;
            return {
                idempotency_key: `${group}:SMS`, group_key: group, type: 'PASSWORD_CHANGED', family: 'ESSENTIAL', channel: 'SMS',
                recipient_user_id: userId, recipient_phone: phone(), template_data: {}, status: 'SENT', attempts: 1,
                due_at: new Date().toISOString(), next_attempt_at: new Date().toISOString(), sent_at: new Date().toISOString(),
            };
        },
        update: { status: 'PENDING', attempts: 0 },
    },
    {
        table: 'notification_preferences', filterColumn: 'user_id', filterValue: ZERO_UUID,
        row: (userId) => ({ user_id: userId ?? ZERO_UUID, topic: 'REMINDERS', channel: 'SMS', enabled: false }),
        update: { enabled: true },
    },
    {
        table: 'push_subscriptions', filterColumn: 'id', filterValue: ZERO_UUID,
        row: (userId) => ({
            user_id: userId ?? ZERO_UUID, endpoint: `https://fcm.googleapis.com/fcm/send/${randomBytes(24).toString('base64url')}`,
            p256dh: 'B'.repeat(87), auth: 'A'.repeat(22), vapid_key_id: 'K'.repeat(16),
        }),
        update: { endpoint: 'https://attaquant.invalid/push' },
    },
    {
        table: 'notification_types', filterColumn: 'type', filterValue: 'PURCHASE_CONFIRMED',
        row: () => ({ type: `R21_${randomBytes(4).toString('hex').toUpperCase()}`, family: 'ESSENTIAL', channels: ['SMS'], audience: 'ANY' }),
        update: { suspended_policy: 'ALLOW', channels: ['SMS', 'IN_APP', 'EMAIL', 'PUSH'] },
    },
];

describe('R21 — tables du lot 6 inaccessibles par REST (42501)', () => {
    for (const t of TABLES) {
        for (const role of ROLES) {
            test(`${role} : ${t.table} — ni lecture, ni insertion, ni modification, ni suppression`, async () => {
                const { client, userId } = await clientFor(role);
                const read = await client.from(t.table).select('*').limit(1);
                assertPrivilegeDenied(read.error, `${role} SELECT ${t.table}`);
                assert.equal(read.data, null, `${role} SELECT ${t.table} : aucune ligne renvoyée`);

                const ins = await client.from(t.table).insert(t.row(userId)).select('*');
                assertPrivilegeDenied(ins.error, `${role} INSERT ${t.table}`);

                const upd = await client.from(t.table).update(t.update).eq(t.filterColumn, t.filterValue).select('*');
                assertPrivilegeDenied(upd.error, `${role} UPDATE ${t.table}`);

                const del = await client.from(t.table).delete().eq(t.filterColumn, t.filterValue).select('*');
                assertPrivilegeDenied(del.error, `${role} DELETE ${t.table}`);
            });
        }
    }
});

describe('R21 — notifications in-app : aucune écriture par REST (contrat F1)', () => {
    let victim: AttackerAccount;
    let self: AttackerAccount;

    before(async () => {
        self = await signUpAttacker('r21-notif-self');
        victim = await signUpAttacker('r21-notif-victime');
    });

    function forgedNotification(userId: string, label: string): Record<string, unknown> {
        // Canal PUSH : valeur valide de l'enum actuel, pour que le refus vienne du privilège et non du type.
        return {
            user_id: userId, type: 'SECURITY', title: `Notification forgée (${label})`,
            content: 'Notification forgée par un test de sécurité.', channel: 'PUSH', status: 'SENT',
            sent_at: new Date().toISOString(), metadata: { actionUrl: 'https://attaquant.invalid/' },
        };
    }

    test('un client ne crée pas de notification à son nom', async () => {
        const res = await self.client.from('notifications').insert(forgedNotification(self.userId, 'client')).select('id');
        assertPrivilegeDenied(res.error, 'client INSERT notifications (son compte)');
    });

    test('un ADMIN connecté ne crée pas de notification au nom d’un autre compte', async () => {
        const admin = await signInFixture('ADMIN');
        const res = await admin.client.from('notifications').insert(forgedNotification(victim.userId, 'admin')).select('id');
        assertPrivilegeDenied(res.error, 'ADMIN INSERT notifications (autre compte)');
    });

    test('un client ne modifie pas ses notifications (titre, statut lu) par REST', async () => {
        const res = await self.client.from('notifications')
            .update({ title: 'Titre modifié par le client', status: 'READ', read_at: new Date().toISOString() })
            .eq('user_id', self.userId).select('id');
        assertPrivilegeDenied(res.error, `client UPDATE notifications (${(res.data ?? []).length} ligne(s) modifiée(s))`);
    });

    test('un client ne modifie pas les notifications d’un autre compte', async () => {
        const res = await self.client.from('notifications').update({ title: 'Titre modifié' }).eq('user_id', victim.userId).select('id');
        if (res.error) {
            assertPrivilegeDenied(res.error, 'client UPDATE notifications (autre compte)');
            return;
        }
        assert.deepEqual(res.data ?? [], [], 'client UPDATE notifications (autre compte) : aucune ligne touchée');
        assert.fail('client UPDATE notifications (autre compte) : refus par le privilège attendu (42501), la base répond sans erreur');
    });

    test('garde-fou : anon ne crée pas de notification', async () => {
        const res = await anonClient().from('notifications').insert(forgedNotification(victim.userId, 'anon')).select('id');
        assertDenied(res.error, 'anon INSERT notifications');
    });

    test('garde-fou : un client ne supprime aucune notification (ni la sienne, ni celle d’un autre)', async () => {
        for (const target of [self.userId, victim.userId]) {
            const beforeRead = await self.client.from('notifications').select('id').eq('user_id', self.userId);
            assert.equal(beforeRead.error, null, `lecture de ses notifications : ${beforeRead.error?.message}`);
            const res = await self.client.from('notifications').delete().eq('user_id', target).select('id');
            if (res.error) {
                assertDenied(res.error, `client DELETE notifications (${target === self.userId ? 'les siennes' : 'autre compte'})`);
            } else {
                assert.deepEqual(res.data ?? [], [], `client DELETE notifications (${target === self.userId ? 'les siennes' : 'autre compte'}) : aucune ligne supprimée`);
            }
            const afterRead = await self.client.from('notifications').select('id').eq('user_id', self.userId);
            assert.equal(afterRead.error, null, afterRead.error?.message);
            assert.equal((afterRead.data ?? []).length, (beforeRead.data ?? []).length, 'ses notifications sont toujours là');
        }
    });

    test('garde-fou : un client lit ses propres notifications (cloche, temps réel) et pas celles d’un autre', async () => {
        const own = await self.client.from('notifications').select('id, user_id').eq('user_id', self.userId);
        assert.equal(own.error, null, `lecture de ses notifications : ${own.error?.message} (code ${own.error?.code})`);
        assert.ok((own.data ?? []).every((n) => n.user_id === self.userId), 'seulement ses notifications');
        const other = await self.client.from('notifications').select('id').eq('user_id', victim.userId);
        assert.equal(other.error, null, other.error?.message);
        assert.deepEqual(other.data ?? [], [], 'aucune notification d’un autre compte');
    });
});
