/**
 * Contre-vérification de la finition 1, attaque 8 — demandes simultanées.
 *
 *  a. Deux « Retirer de l'équipe », deux « Retirer de cet événement », et les deux à la fois : pas d'erreur serveur, un
 *     seul retrait effectif, un seul SMS de retrait, état final cohérent.
 *  b. Invitations : quatre invitations simultanées du même numéro par la même organisatrice (au plus une en attente,
 *     invariant f2) ; « Renvoyer » et « Annuler » en même temps ; « Renvoyer » et l'acceptation en même temps.
 *  c. Six réglages simultanés du même contrôleur : pas d'erreur serveur, l'état final est l'un des réglages envoyés, un
 *     journal par réglage accepté.
 *  d. Porte : celle d'un autre événement ; une porte supprimée avant ; une porte supprimée PENDANT l'enregistrement
 *     (transaction concurrente qui tient la suppression) : jamais une affectation vers une porte qui n'existe pas.
 * Sortie brute `[CVF1-8]`.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { newBuyer, service, type Buyer, type SaleEvent } from '../parcours/paiement-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { assignController, newController } from '../parcours/acces-helpers';
import { outboxRows } from '../parcours/notif-helpers';
import { createZonedEvent, type ZonedEvent } from '../parcours/zones-helpers';
import { openConcurrentClient, waitForLockWaiters } from '../helpers/db';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import {
    CATS, FREE, PAID, api, assignmentOf, freeEvent, invitationRow, invitationsFor, inviteExisting, ok2xx, rolesOf, show,
    smsCount, type Reply,
} from './cvf1-helpers';

let P: TestPartner;
let ev: SaleEvent;
let ev2: SaleEvent;

before(async () => {
    P = await newPartner('cvf1-course');
    ev = await freeEvent(P, 'course', { startsInHours: 48 });
    ev2 = await freeEvent(P, 'course-2', { startsInHours: 48 });
});

after(async () => {
    await assertFinition1Invariants('cvf1-8-courses');
});

function statuses(rs: Reply[]): string {
    return rs.map((r) => r.status).join(', ');
}

async function removeTeam(c: Buyer): Promise<Reply> {
    return api('DELETE', 'partner/team/controller/[controllerId]', { token: P.accessToken, path: `/api/partner/team/controller/${c.userId}`, params: { controllerId: c.userId } });
}

async function removeEvent(eventId: string, assignmentId: string): Promise<Reply> {
    return api('DELETE', 'partner/team/[eventId]', { token: P.accessToken, path: `/api/partner/team/${eventId}?assignmentId=${assignmentId}`, params: { eventId } });
}

async function removalSms(userId: string): Promise<number> {
    return (await outboxRows({ type: 'CONTROLLER_UNASSIGNED', userId, channel: 'SMS' })).length;
}

describe('a. retraits simultanés', () => {
    test('deux « Retirer de l’équipe » : un seul effectif, aucun 500, un seul SMS', async () => {
        const c = await newController(P, ev.eventId, { label: 'cvf1-course-equipe' });
        const rs = await Promise.all([removeTeam(c), removeTeam(c)]);
        const sms = await removalSms(c.userId);
        console.log(`[CVF1-8] deux « Retirer de l'équipe » : ${statuses(rs)} ; SMS de retrait ${sms} ; rôles ${(await rolesOf(c.userId)).join(',')}`);
        assert.ok(rs.every((r) => r.status < 500), `erreur serveur : ${rs.map(show).join(' | ')}`);
        assert.equal(rs.filter(ok2xx).length >= 1, true, `aucun retrait accepté : ${rs.map(show).join(' | ')}`);
        assert.equal(await assignmentOf(ev.eventId, c.userId), null, 'affectation encore présente');
        assert.ok(sms <= 1, `${sms} SMS de retrait pour un seul retrait`);
    });

    test('deux « Retirer de cet événement » : un seul effectif, aucun 500', async () => {
        const c = await newController(P, ev.eventId, { label: 'cvf1-course-evt' });
        const a = await assignmentOf(ev.eventId, c.userId);
        const rs = await Promise.all([removeEvent(ev.eventId, String(a!.id)), removeEvent(ev.eventId, String(a!.id))]);
        const sms = await removalSms(c.userId);
        console.log(`[CVF1-8] deux « Retirer de cet événement » : ${statuses(rs)} ; SMS de retrait ${sms}`);
        assert.ok(rs.every((r) => r.status < 500), `erreur serveur : ${rs.map(show).join(' | ')}`);
        assert.equal(rs.filter(ok2xx).length, 1, `retraits acceptés : ${rs.map(show).join(' | ')}`);
        assert.ok(sms <= 1, `${sms} SMS de retrait pour un seul retrait`);
    });

    test('« Retirer de l’équipe » et « Retirer de cet événement » en même temps : état cohérent, aucun 500', async () => {
        const c = await newController(P, ev.eventId, { label: 'cvf1-course-mixte' });
        await assignController(P, c.userId, ev2.eventId, false);
        const a = await assignmentOf(ev.eventId, c.userId);
        const rs = await Promise.all([removeTeam(c), removeEvent(ev.eventId, String(a!.id))]);
        console.log(`[CVF1-8] retrait de l'équipe + retrait de l'événement : ${statuses(rs)} ; affectations restantes ${JSON.stringify([await assignmentOf(ev.eventId, c.userId), await assignmentOf(ev2.eventId, c.userId)])}`);
        assert.ok(rs.every((r) => r.status < 500), `erreur serveur : ${rs.map(show).join(' | ')}`);
        assert.equal(await assignmentOf(ev.eventId, c.userId), null, 'affectation à l’événement encore présente');
        assert.equal(await assignmentOf(ev2.eventId, c.userId), null, 'affectation à l’autre événement encore présente après « Retirer de l’équipe »');
    });
});

describe('b. invitations simultanées', () => {
    test('quatre invitations simultanées du même numéro : au plus une invitation en attente', async () => {
        const team = await newPartner('cvf1-course-inv');
        const evt = await freeEvent(team, 'course-inv', { startsInHours: 48 });
        const h = await newBuyer('cvf1-course-double', { firstName: 'Double', lastName: 'Invitation' });
        const rs = await Promise.all(Array.from({ length: 4 }, () => api('POST', 'partner/team/invite', {
            token: team.accessToken, body: { event_ids: [evt.eventId], phone: h.phoneE164, confirm_promotion: true },
        })));
        const rows = await invitationsFor(team.partnerId, h.userId);
        const pending = rows.filter((r) => r.status === 'PENDING' && new Date(String(r.expires_at)).getTime() > Date.now());
        const sms = await smsCount('CONTROLLER_INVITATION', h.userId);
        console.log(`[CVF1-8] quatre invitations simultanées : ${statuses(rs)} ; invitations ${JSON.stringify(rows.map((r) => r.status))} ; en attente ${pending.length} ; SMS ${sms}`);
        try {
            assert.ok(rs.every((r) => r.status < 500), `erreur serveur : ${rs.map(show).join(' | ')}`);
            assert.ok(pending.length <= 1, `${pending.length} invitations en attente pour le même organisateur et le même numéro (invariant f2), ${sms} SMS`);
        } finally {
            // Doublons fermés après le constat : l'invariant f2 ne doit pas faire tomber les suites suivantes en cascade
            for (const extra of pending.slice(1)) {
                const { error } = await service.from('controller_invitations')
                    .update({ status: 'CANCELLED', responded_at: new Date().toISOString(), cleared_at: new Date().toISOString() }).eq('id', String(extra.id));
                assert.equal(error, null, `fermeture du doublon ${String(extra.id)} : ${error?.message}`);
            }
        }
    });

    test('« Renvoyer » et « Annuler » en même temps : aucun 500, état final cohérent', async () => {
        const h = await newBuyer('cvf1-course-rc', { firstName: 'Renvoi', lastName: 'Annule' });
        const id = await inviteExisting(P, [ev.eventId], h);
        const rs = await Promise.all([
            api('POST', 'partner/team/invitations/[id]/resend', { token: P.accessToken, path: `/api/partner/team/invitations/${id}/resend`, params: { id } }),
            api('POST', 'partner/team/invitations/[id]/cancel', { token: P.accessToken, path: `/api/partner/team/invitations/${id}/cancel`, params: { id } }),
        ]);
        const row = await invitationRow(id);
        console.log(`[CVF1-8] renvoi + annulation : ${statuses(rs)} ; état ${String(row.status)} ; send_count ${String(row.send_count)}`);
        assert.ok(rs.every((r) => r.status < 500), `erreur serveur : ${rs.map(show).join(' | ')}`);
        assert.equal(row.status, 'CANCELLED', 'l’annulation doit l’emporter (elle passe avant ou après le renvoi)');
        assert.equal(Number(row.send_count), 1 + (ok2xx(rs[0]) ? 1 : 0), 'compteur d’envois');
    });

    test('« Renvoyer » et l’acceptation en même temps : aucun 500, une seule issue', async () => {
        const h = await newBuyer('cvf1-course-ra', { firstName: 'Renvoi', lastName: 'Accepte' });
        const id = await inviteExisting(P, [ev2.eventId], h);
        const rs = await Promise.all([
            api('POST', 'partner/team/invitations/[id]/resend', { token: P.accessToken, path: `/api/partner/team/invitations/${id}/resend`, params: { id } }),
            api('POST', 'account/controller-invitations/[id]', { token: h.accessToken, path: `/api/account/controller-invitations/${id}`, params: { id }, body: { accept: true } }),
        ]);
        const row = await invitationRow(id);
        console.log(`[CVF1-8] renvoi + acceptation : ${statuses(rs)} ; état ${String(row.status)}`);
        assert.ok(rs.every((r) => r.status < 500), `erreur serveur : ${rs.map(show).join(' | ')}`);
        assert.equal(row.status, 'ACCEPTED', 'l’acceptation doit aboutir');
        assert.ok(await assignmentOf(ev2.eventId, h.userId), 'affectation créée par l’acceptation');
    });
});

describe('c. réglages simultanés', () => {
    test('six réglages simultanés : aucun 500, état final = un réglage envoyé, un journal par réglage accepté', async () => {
        const c = await newController(P, ev.eventId, { label: 'cvf1-course-reglages' });
        const bodies = Array.from({ length: 6 }, (_, i) => ({ eventId: ev.eventId, controllerId: c.userId, entryPoint: `Porte ${i}`, canAcceptCash: i % 2 === 0 }));
        const rs = await Promise.all(bodies.map((body) => api('PATCH', 'partner/team/settings', { token: P.accessToken, body })));
        const final = await assignmentOf(ev.eventId, c.userId);
        const { data: logs } = await service.from('audit_logs').select('id').eq('action', 'CONTROLLER_SETTINGS_SET').eq('object_id', String(final!.id));
        console.log(`[CVF1-8] six réglages simultanés : ${statuses(rs)} ; final ${JSON.stringify({ entry_point: final!.entry_point, can_accept_cash: final!.can_accept_cash })} ; journaux ${(logs ?? []).length}`);
        assert.ok(rs.every((r) => r.status < 500), `erreur serveur : ${rs.map(show).join(' | ')}`);
        assert.ok(bodies.some((b) => b.entryPoint === final!.entry_point && b.canAcceptCash === final!.can_accept_cash), `état final mélangé : ${JSON.stringify(final)}`);
        assert.equal((logs ?? []).length, rs.filter(ok2xx).length, 'un journal par réglage accepté');
    });
});

describe('d. porte d’un autre événement, porte supprimée', () => {
    let Z: ZonedEvent;
    let Z2: ZonedEvent;
    let c: Buyer;
    let north: string;
    before(async () => {
        const zones = [{ name: 'Pelouse', kind: 'ENTREE' as const, admits: [FREE, PAID], gates: ['Porte Nord', 'Porte Sud'] }];
        Z = await createZonedEvent(P, 'cvf1-course-z', CATS, zones, { startsInHours: 48 });
        Z2 = await createZonedEvent(P, 'cvf1-course-z2', CATS, zones, { startsInHours: 48 });
        north = Z.zones['Pelouse'].gates['Porte Nord'];
        c = await newController(P, Z.eventId, { label: 'cvf1-course-porte' });
        const r = await api('PATCH', 'partner/team/settings', { token: P.accessToken, body: { eventId: Z.eventId, controllerId: c.userId, gateId: north, canAcceptCash: false } });
        assert.equal(r.status, 200, `porte Nord (montage) : ${show(r)}`);
    });

    async function gateExists(id: string): Promise<boolean> {
        const { data } = await service.from('event_gates').select('id').eq('id', id).maybeSingle();
        return !!data;
    }

    test('porte d’un autre événement, puis porte supprimée avant : refusées, la porte ne change pas', async () => {
        const foreign = Z2.zones['Pelouse'].gates['Porte Nord'];
        const r1 = await api('PATCH', 'partner/team/settings', { token: P.accessToken, body: { eventId: Z.eventId, controllerId: c.userId, gateId: foreign, canAcceptCash: false } });
        const south = Z.zones['Pelouse'].gates['Porte Sud'];
        const { error } = await service.from('event_gates').delete().eq('id', south);
        assert.equal(error, null, `porte Sud supprimée (montage) : ${error?.message}`);
        const r2 = await api('PATCH', 'partner/team/settings', { token: P.accessToken, body: { eventId: Z.eventId, controllerId: c.userId, gateId: south, canAcceptCash: false } });
        console.log(`[CVF1-8] porte d'un autre événement → ${show(r1)} ; porte supprimée → ${show(r2)}`);
        assert.ok(!ok2xx(r1), `porte d'un autre événement acceptée : ${show(r1)}`);
        assert.ok(!ok2xx(r2), `porte supprimée acceptée : ${show(r2)}`);
        assert.equal((await assignmentOf(Z.eventId, c.userId))?.gate_id, north, 'porte du contrôleur modifiée');
    });

    test('porte supprimée pendant l’enregistrement : jamais d’affectation vers une porte absente', async () => {
        const { data: g, error } = await service.from('event_gates').insert({ event_id: Z.eventId, zone_id: Z.zones['Pelouse'].id, name: 'Porte Ephemere' }).select('id').single();
        assert.equal(error, null, `porte éphémère (montage) : ${error?.message}`);
        const gate = String(g!.id);
        const tx = await openConcurrentClient({ applicationName: 'cvf1-suppression-porte' });
        let reply: Reply | null = null;
        try {
            await tx.query('DELETE FROM public.event_gates WHERE id = $1', [gate]);
            const pending = api('PATCH', 'partner/team/settings', { token: P.accessToken, body: { eventId: Z.eventId, controllerId: c.userId, gateId: gate, canAcceptCash: false } });
            try {
                const waiters = await waitForLockWaiters({ queryLike: '%event_controller_settings_set%' }, 8_000);
                console.log(`[CVF1-8] enregistrement en attente de la suppression : ${waiters.length} attente(s)`);
            } catch (err) {
                console.log(`[CVF1-8] aucune attente de verrou observée (${err instanceof Error ? err.message.slice(0, 160) : String(err)}) : suppression validée quand même`);
            }
            await tx.commit();
            reply = await pending;
        } finally {
            await tx.close();
        }
        const final = await assignmentOf(Z.eventId, c.userId);
        console.log(`[CVF1-8] porte supprimée pendant l'enregistrement → ${reply ? show(reply) : 'aucune réponse'} ; porte finale ${String(final?.gate_id)} (existe : ${final?.gate_id ? await gateExists(String(final.gate_id)) : 'sans porte'})`);
        if (final?.gate_id) assert.ok(await gateExists(String(final.gate_id)), `affectation vers une porte supprimée : ${String(final.gate_id)}`);
        assert.ok(!(reply && ok2xx(reply) && reply.body.gate && (reply.body.gate as Record<string, unknown>).id === gate), `enregistrement accepté vers la porte supprimée : ${reply ? show(reply) : ''}`);
    });
});
