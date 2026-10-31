/**
 * Lot 1B.3 — l'abonnement Realtime du scanner (UPDATE sur tickets filtré par event_id)
 * fonctionne pour l'événement affecté et ne reçoit rien pour un autre événement.
 *
 * CONTROLLER_A (affecté à A_PUBLIE) s'abonne, avec sa propre session, aux mises à jour des
 * billets de A_PUBLIE et de B_PUBLIE, exactement comme app/controller/scanner/page.tsx.
 * Le service_role touche ensuite les billets de référence.
 *  1. Vivacité : le billet de A est touché jusqu'à réception (abonnement effectif).
 *  2. Le billet de B est touché, puis celui de A (sentinelle). Realtime délivre dans l'ordre du
 *     journal : la sentinelle reçue sans l'événement de B prouve que B a été filtré par la RLS.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { FIXTURE_TICKETS, FIXTURE_USERS, TEST_PASSWORD, loadFixtures } from '../helpers/fixtures';

interface Received { eventId: string; ticketNumber: string }

async function waitFor(check: () => Promise<boolean> | boolean, timeoutMs: number, stepMs: number, what: string): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await check()) return;
        await new Promise((r) => setTimeout(r, stepMs));
    }
    throw new Error(`délai dépassé (${timeoutMs} ms) : ${what}`);
}

describe('Realtime du scanner', () => {
    test("CONTROLLER_A reçoit les mises à jour des billets de son événement, pas celles de l'événement de B", async () => {
        const fx = await loadFixtures();
        const eventA = fx.events.A_PUBLIE.id;
        const eventB = fx.events.B_PUBLIE.id;
        const service = getServiceRoleClient();
        const { data: tickets, error: tErr } = await service
            .from('tickets')
            .select('id, ticket_number, event_id')
            .in('ticket_number', [FIXTURE_TICKETS.CLIENT_A_STANDARD.ticketNumber, FIXTURE_TICKETS.CLIENT_BIS_B_STANDARD.ticketNumber]);
        assert.equal(tErr, null, `billets de référence : ${tErr?.message}`);
        const ticketA = tickets!.find((t) => t.event_id === eventA);
        const ticketB = tickets!.find((t) => t.event_id === eventB);
        assert.ok(ticketA && ticketB, 'billets de référence de A_PUBLIE et de B_PUBLIE présents (seed)');

        const controller = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        const { error: signInErr } = await controller.auth.signInWithPassword({ email: FIXTURE_USERS.CONTROLLER_A.email, password: TEST_PASSWORD });
        assert.equal(signInErr, null, `connexion du contrôleur : ${signInErr?.message}`);

        const received: Received[] = [];
        const onUpdate = (payload: { new: Record<string, unknown> }) => {
            received.push({ eventId: String(payload.new.event_id), ticketNumber: String(payload.new.ticket_number) });
        };
        let channel: RealtimeChannel | null = null;
        try {
            channel = controller
                .channel(`scanner-test-${randomBytes(4).toString('hex')}`)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `event_id=eq.${eventA}` }, onUpdate)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `event_id=eq.${eventB}` }, onUpdate);
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('abonnement Realtime non confirmé en 20 s')), 20_000);
                channel!.subscribe((status, err) => {
                    if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(); }
                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timer); reject(new Error(`abonnement : ${status} ${err?.message ?? ''}`)); }
                });
            });

            const touch = async (id: string) => {
                const { error } = await service.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', id);
                assert.equal(error, null, `mise à jour du billet ${id} : ${error?.message}`);
            };

            await waitFor(async () => {
                await touch(ticketA.id);
                return received.some((r) => r.eventId === eventA);
            }, 30_000, 1_500, "réception d'une mise à jour du billet de l'événement affecté");

            received.length = 0;
            await touch(ticketB.id);
            await touch(ticketA.id);
            await waitFor(() => received.some((r) => r.eventId === eventA), 20_000, 250, 'réception de la sentinelle (billet de A)');
            await new Promise((r) => setTimeout(r, 1_000));

            const fromB = received.filter((r) => r.eventId === eventB);
            assert.deepEqual(fromB, [], `mises à jour d'un billet de B reçues par le contrôleur de A : ${JSON.stringify(fromB)}`);
        } finally {
            if (channel) await controller.removeChannel(channel);
            controller.realtime.disconnect();
        }
    });
});
