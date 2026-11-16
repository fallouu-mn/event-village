/**
 * Contre-vérification de la finition 2a — aides communes aux suites `tests/audit/cvf2a-*.test.ts`.
 *
 * L'attaquant joue avec ses propres sessions (clé publique + jeton), par les vraies routes de l'application, par la REST
 * de Supabase ou par le stockage. Le montage passe par le service_role sur la base LOCALE, comme les suites du lot.
 * Aucune assertion n'est assouplie pour faire passer une suite : une suite verte dit que l'attaque a échoué.
 */
import '../helpers/env';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { BASE_URL } from '../parcours/helpers';
import { newBuyer, service, type Buyer } from '../parcours/paiement-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { assignController, newController } from '../parcours/acces-helpers';
import { createZonedEvent, type ZonedEvent } from '../parcours/zones-helpers';
import { CATS, FREE, PAID, api, freeEvent, freeTicket, inviteExisting, show, type Reply, type Row } from './cvf1-helpers';
import type { SaleEvent } from '../parcours/paiement-helpers';

export { CATS, FREE, PAID };

export const BUCKET = 'public-images';

/** Organisatrice montée avec tout ce qu'une écriture peut viser : événement à portes et sans porte, contrôleur, invitation, billet. */
export interface Mount {
    P: TestPartner;
    ev: ZonedEvent;
    flat: SaleEvent;
    gate1: string;
    gate2: string;
    ctrl: Buyer;
    assignmentId: string;
    invited: Buyer;
    invitationId: string;
    ticket: { id: string; number: string };
}

export async function mount(label: string, opts: { canAcceptCash?: boolean } = {}): Promise<Mount> {
    const P = await newPartner(`cvf2a-${label}`);
    const ev = await createZonedEvent(P, `cvf2a-${label}`, CATS, [{ name: 'Pelouse', kind: 'ENTREE', admits: [FREE, PAID], gates: ['Porte 1', 'Porte 2'] }], { startsInHours: 1 });
    const gate1 = ev.zones['Pelouse'].gates['Porte 1'];
    const gate2 = ev.zones['Pelouse'].gates['Porte 2'];
    const flat = await freeEvent(P, `cvf2a-${label}-plat`, { startsInHours: 1 });
    const ctrl = await newController(P, ev.eventId, { label: `cvf2a-${label}`, canAcceptCash: opts.canAcceptCash ?? false });
    const { error: gErr } = await service.from('event_controllers').update({ gate_id: gate1, entry_point: 'Porte 1' }).eq('event_id', ev.eventId).eq('user_id', ctrl.userId);
    assert.equal(gErr, null, `porte du contrôleur (montage) : ${gErr?.message}`);
    await assignController(P, ctrl.userId, flat.eventId, false);
    const { data: a, error: aErr } = await service.from('event_controllers').select('id').eq('event_id', ev.eventId).eq('user_id', ctrl.userId).single();
    assert.equal(aErr, null, `affectation (montage) : ${aErr?.message}`);
    const invited = await newBuyer(`cvf2a-${label}-invite`);
    const invitationId = await inviteExisting(P, [ev.eventId], invited);
    const ticket = await freeTicket(ev, await newBuyer(`cvf2a-${label}-porteur`));
    return { P, ev, flat, gate1, gate2, ctrl, assignmentId: String(a!.id), invited, invitationId, ticket };
}

/** Invitation renvoyable : dernier envoi reculé de deux heures (le délai entre deux renvois ne doit pas masquer l'essai). */
export async function makeResendable(invitationId: string): Promise<void> {
    const { error } = await service.from('controller_invitations').update({ last_sent_at: new Date(Date.now() - 2 * 3600_000).toISOString() }).eq('id', invitationId);
    assert.equal(error, null, `invitation renvoyable (montage) : ${error?.message}`);
}

/** État de l'événement, de ses catégories, billets, zones, portes, code du régisseur. */
export async function eventState(eventId: string): Promise<string> {
    const [ev, cats, tickets, zones, gates, pin, transfers] = await Promise.all([
        service.from('events').select('title, status, updated_at, image_url, latitude, longitude, start_date, start_time').eq('id', eventId).single(),
        service.from('ticket_categories').select('id, name, price, total_quantity, is_active, is_visible').eq('event_id', eventId).order('id'),
        service.from('tickets').select('id, status, user_id, guest_name').eq('event_id', eventId).order('id'),
        service.from('event_zones').select('id, name').eq('event_id', eventId).order('id'),
        service.from('event_gates').select('*').eq('event_id', eventId).order('id'),
        service.from('event_regisseur_pins').select('*').eq('event_id', eventId),
        service.from('ticket_transfers').select('id, status, ticket_id').in('ticket_id',
            ((await service.from('tickets').select('id').eq('event_id', eventId)).data ?? []).map((t) => String(t.id))).order('id'),
    ]);
    return JSON.stringify([ev.data, cats.data, tickets.data, zones.data, gates.data, pin.data, transfers.data]);
}

/** État de l'équipe de la partenaire : affectations, invitations, lien partenaire–contrôleur, rôles, SMS d'invitation. */
export async function teamState(m: Mount): Promise<string> {
    const eventIds = [m.ev.eventId, m.flat.eventId];
    const [assign, invs, links, roles, sms] = await Promise.all([
        service.from('event_controllers').select('event_id, user_id, gate_id, entry_point, can_accept_cash, gate_change_allowed').in('event_id', eventIds).order('event_id').order('user_id'),
        service.from('controller_invitations').select('id, status, send_count, cleared_at, user_id').eq('partner_id', m.P.partnerId).order('id'),
        service.from('partner_controllers').select('partner_id, user_id').eq('partner_id', m.P.partnerId).order('user_id'),
        service.from('user_roles').select('role').eq('user_id', m.ctrl.userId).order('role'),
        service.from('notification_outbox').select('id', { count: 'exact', head: true }).eq('type', 'CONTROLLER_INVITATION').eq('channel', 'SMS')
            .in('recipient_user_id', [m.invited.userId, m.ctrl.userId]),
    ]);
    return JSON.stringify([assign.data, invs.data, links.data, roles.data, sms.count]);
}

export interface Attempt { what: string; reply: Reply }

/**
 * Toutes les écritures de l'onglet Équipe sur les événements de la partenaire, avec son jeton. Ordre : réglages, portes,
 * invitations (y compris un numéro inconnu), renvoi, annulation, effacement, puis les retraits (destructifs) en dernier.
 */
export async function teamWrites(m: Mount, token: string): Promise<Attempt[]> {
    const out: Attempt[] = [];
    const push = async (what: string, reply: Promise<Reply>) => {
        const r = await reply;
        console.log(`[CVF2A] ${what} → ${show(r).slice(0, 260)}`);
        out.push({ what, reply: r });
    };
    const freshNumber = await newBuyer('cvf2a-equipe-neuf');
    await push('PATCH /api/partner/team/settings (porte 2, espèces)', api('PATCH', 'partner/team/settings', {
        token, body: { eventId: m.ev.eventId, controllerId: m.ctrl.userId, gateId: m.gate2, gateChangeAllowed: true, canAcceptCash: true },
    }));
    await push('PATCH /api/partner/team/gate (porte 2)', api('PATCH', 'partner/team/gate', {
        token, body: { eventId: m.ev.eventId, controllerId: m.ctrl.userId, gateId: m.gate2, gateChangeAllowed: true },
    }));
    await push('PATCH /api/partner/team/entry-point (événement sans porte)', api('PATCH', 'partner/team/entry-point', {
        token, body: { eventId: m.flat.eventId, controllerId: m.ctrl.userId, entryPoint: 'Sortie de secours' },
    }));
    await push('PATCH /api/partner/team/assignments/[id] (espèces)', api('PATCH', 'partner/team/assignments/[id]', {
        token, path: `/api/partner/team/assignments/${m.assignmentId}`, params: { id: m.assignmentId }, body: { canAcceptCash: true },
    }));
    await push('POST /api/partner/team/invite (compte existant)', api('POST', 'partner/team/invite', {
        token, body: { event_ids: [m.ev.eventId], phone: freshNumber.phoneE164, confirm_promotion: true },
    }));
    await makeResendable(m.invitationId);
    await push('POST /api/partner/team/invitations/[id]/resend', api('POST', 'partner/team/invitations/[id]/resend', {
        token, path: `/api/partner/team/invitations/${m.invitationId}/resend`, params: { id: m.invitationId }, body: {},
    }));
    await push('POST /api/partner/team/invitations/[id]/cancel', api('POST', 'partner/team/invitations/[id]/cancel', {
        token, path: `/api/partner/team/invitations/${m.invitationId}/cancel`, params: { id: m.invitationId }, body: {},
    }));
    await push('DELETE /api/partner/team/invitations/[id] (effacer)', api('DELETE', 'partner/team/invitations/[id]', {
        token, path: `/api/partner/team/invitations/${m.invitationId}`, params: { id: m.invitationId }, body: {},
    }));
    await push('PATCH /api/partner/team/assignments (retire l’événement sans porte)', api('PATCH', 'partner/team/assignments', {
        token, body: { controllerId: m.ctrl.userId, eventIds: [m.ev.eventId] },
    }));
    await push('DELETE /api/partner/team/[eventId] (Retirer de cet événement)', api('DELETE', 'partner/team/[eventId]', {
        token, path: `/api/partner/team/${m.ev.eventId}?assignmentId=${m.assignmentId}`, params: { eventId: m.ev.eventId },
    }));
    await push('DELETE /api/partner/team/controller/[controllerId] (Retirer de l’équipe)', api('DELETE', 'partner/team/controller/[controllerId]', {
        token, path: `/api/partner/team/controller/${m.ctrl.userId}`, params: { controllerId: m.ctrl.userId },
    }));
    await push('DELETE /api/partner/team/all', api('DELETE', 'partner/team/all', {
        token, path: `/api/partner/team/all?controllerId=${m.ctrl.userId}`,
    }));
    return out;
}

/** Écritures acceptées (2xx) parmi les essais. */
export function accepted(attempts: Attempt[]): string[] {
    return attempts.filter((a) => a.reply.status >= 200 && a.reply.status < 300).map((a) => `${a.what} → ${show(a.reply).slice(0, 200)}`);
}

export async function versionOf(eventId: string): Promise<string> {
    const { data, error } = await service.from('events').select('updated_at').eq('id', eventId).single();
    assert.equal(error, null, `version de ${eventId} : ${error?.message}`);
    return String(data!.updated_at);
}

export async function putEvent(token: string, eventId: string, patch: Row): Promise<Reply> {
    return api('PUT', 'partner/events/[id]', {
        token, path: `/api/partner/events/${eventId}`, params: { id: eventId },
        body: { patch, expected_updated_at: await versionOf(eventId) },
    });
}

/** Dépôt par la route POST /api/partner/upload (multipart), comme le formulaire. */
export async function uploadImage(token: string, bytes: Buffer, name: string, type: string, folder = 'events'): Promise<Reply & { path?: string; url?: string }> {
    const { POST } = (await import('../../app/api/partner/upload/route')) as { POST: (req: NextRequest) => Promise<Response> };
    const form = new FormData();
    form.append('file', new File([new Uint8Array(bytes)], name, { type }));
    form.append('folder', folder);
    const res = await POST(new NextRequest(`${BASE_URL}/api/partner/upload`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form }));
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? (JSON.parse(text) as Row) : {};
    } catch {
        body = { raw: text.slice(0, 300) };
    }
    return { status: res.status, body, path: typeof body.filePath === 'string' ? body.filePath : undefined, url: typeof body.url === 'string' ? body.url : undefined };
}

/** Fichiers du dossier `<prefix>` du compartiment public (noms). */
export async function listFolder(prefix: string): Promise<string[]> {
    const { data, error } = await service.storage.from(BUCKET).list(prefix, { limit: 1000 });
    assert.equal(error, null, `dossier ${prefix} : ${error?.message}`);
    return (data ?? []).filter((o) => o.id !== null).map((o) => o.name).sort();
}

export async function stored(pathInBucket: string): Promise<Buffer | null> {
    const { data, error } = await service.storage.from(BUCKET).download(pathInBucket);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
}

/** Fichier posé directement dans le stockage (montage service_role : affiche d'avant la finition, image d'une salle…). */
export async function putObject(pathInBucket: string, bytes: Buffer, contentType: string): Promise<string> {
    const { error } = await service.storage.from(BUCKET).upload(pathInBucket, bytes, { contentType, upsert: true });
    assert.equal(error, null, `fichier ${pathInBucket} (montage) : ${error?.message}`);
    return service.storage.from(BUCKET).getPublicUrl(pathInBucket).data.publicUrl;
}

export function uniqueName(ext: string): string {
    return `${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;
}
