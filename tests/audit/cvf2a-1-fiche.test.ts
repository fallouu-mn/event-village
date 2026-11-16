/**
 * Contre-vérification de la finition 2a, attaque 1 — fiche partenaire SUSPENDU (puis EN_ATTENTE et REJETE) : toute
 * écriture encore possible sur ses événements ou leurs billets, HORS des 17 routes listées au rapport (§ 1.1).
 *
 * L'organisatrice garde une session valable (compte ACTIF) ; seule sa fiche change, comme dans f2a-fiche-suspendue.
 *  a. Onglet Équipe (/api/partner/team/*) : réglages, porte, point d'entrée, droit d'encaisser, invitation d'un
 *     contrôleur (SMS), renvoi, annulation, effacement, affectations, retraits ;
 *  b. la même chose en base : event_controller_settings_set, event_controller_gate_set, controller_invitation_create
 *     appelées avec la partenaire suspendue pour auteur (témoin : la même fonction acceptée quand la fiche est VALIDE) ;
 *  c. caisse : validation de l'écart d'une caisse de son événement ;
 *  d. contrôle et guichet sur son propre événement (scan, saisie, invités, devis, vente, ouverture de caisse, porte) ;
 *  e. billets : transfert et annulation du transfert d'une invitation ;
 *  f. REST de Supabase avec son jeton (événement, catégories, billets, zones, portes, affectations, invitations, code du
 *     régisseur, transferts) ;
 *  g. toute fonction exécutable par `authenticated`, appelée avec son jeton ;
 *  h. stockage avec son jeton : déposer, remplacer, effacer une affiche ;
 *  i. fiche EN_ATTENTE puis REJETE : équipe, routes d'écriture de l'événement, dépôt, contrôle ;
 *  j. fiche réactivée (directement, puis par partner_status_set et reconnexion) : tout revient.
 * Une attaque réussie = un 2xx (ou un scan « valid ») ou un état changé. Sortie brute `[CVF2A]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { newBuyer, service } from '../parcours/paiement-helpers';
import { openShift } from '../parcours/acces-helpers';
import { confirmPassword, randomSenegalPhone, STRONG_PASSWORD } from '../parcours/helpers';
import { newAdmin } from '../parcours/notif-helpers';
import { inspect } from '../helpers/db';
import { gotrueEmail } from '../helpers/gotrue-email';
import { stepUpTestSession } from '../helpers/admin-step-up';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { api, restRpc, scanTicket, setFiche, show, ticketStatus, userClient, type Reply, type Row } from './cvf1-helpers';
import {
    BUCKET, FREE, PAID, accepted, eventState, mount, putEvent, putObject, teamState, teamWrites, uniqueName, uploadImage,
    versionOf, type Attempt, type Mount,
} from './cvf2a-helpers';

let S: Mount;   // fiche SUSPENDU : onglet Équipe par les routes
let SB: Mount;  // fiche SUSPENDU : fonctions d'équipe en base
let SD: Mount;  // fiche SUSPENDU : caisse, contrôle, transferts, REST, RPC, stockage
let shiftId: string;
let transferId: string;
let invitationTicketId: string;
let ownPosterPath: string;
const restore: string[] = [];

before(async () => {
    S = await mount('susp-equipe');
    SB = await mount('susp-base');
    SD = await mount('susp-divers', { canAcceptCash: true });
    // SD : caisse ouverte puis fermée avec un écart par son contrôleur, avant la suspension
    const opened = await openShift(SD.ctrl, SD.ev.eventId, 0);
    assert.equal(opened.status, 200, `ouverture de caisse (montage) : ${JSON.stringify(opened.body).slice(0, 300)}`);
    shiftId = String((opened.body.shift as { id?: string } | undefined)?.id ?? opened.body.shift_id ?? opened.body.id);
    const closed = await api('POST', 'controller/shifts/close', {
        token: SD.ctrl.accessToken, body: { shiftId, declaredCashTotal: 500, justification: 'Monnaie rendue en trop (montage cvf2a)' },
    });
    assert.equal(closed.status, 200, `clôture avec écart (montage) : ${show(closed)}`);
    assert.equal(closed.body.discrepancy_pending, true, `écart en attente (montage) : ${show(closed)}`);
    // SD : invitation de billet (billet sans compte et transfert en attente vers un numéro)
    const inv = await api('POST', 'partner/events/[id]/invitations', {
        token: SD.P.accessToken, path: `/api/partner/events/${SD.ev.eventId}/invitations`, params: { id: SD.ev.eventId },
        body: { category_id: SD.ev.categories[FREE].id, phones: [randomSenegalPhone('77')], quantity: 1 },
    });
    assert.ok(inv.status < 300, `invitation de billet (montage) : ${show(inv)}`);
    const { data: t, error: tErr } = await service.from('tickets').select('id').eq('event_id', SD.ev.eventId).eq('sale_channel', 'INVITATION').limit(1).single();
    assert.equal(tErr, null, `billet d'invitation (montage) : ${tErr?.message}`);
    invitationTicketId = String(t!.id);
    const { data: tr, error: trErr } = await service.from('ticket_transfers').select('id').eq('ticket_id', invitationTicketId).limit(1).single();
    assert.equal(trErr, null, `transfert de l'invitation (montage) : ${trErr?.message}`);
    transferId = String(tr!.id);
    // SD : affiche réellement stockée, citée par l'événement sans porte
    ownPosterPath = `events/${SD.P.partnerId}/${uniqueName('webp')}`;
    const url = await putObject(ownPosterPath, await sharp({ create: { width: 64, height: 40, channels: 3, background: { r: 10, g: 90, b: 60 } } }).webp().toBuffer(), 'image/webp');
    const { error: imgErr } = await service.from('events').update({ image_url: url }).eq('id', SD.flat.eventId);
    assert.equal(imgErr, null, `affiche de l'événement (montage) : ${imgErr?.message}`);
    for (const m of [S, SB, SD]) {
        await setFiche(m.P.partnerId, 'SUSPENDU');
        restore.push(m.P.partnerId);
    }
});

after(async () => {
    for (const id of restore) await setFiche(id, 'VALIDE');
    await assertFinition1Invariants('cvf2a-1-fiche');
});

function list(lines: string[]): string {
    return lines.map((l) => `  - ${l}`).join('\n');
}

describe('a, b. fiche SUSPENDU : onglet Équipe', () => {
    test('a. routes de l’équipe sur ses événements : refusées, rien ne change', async () => {
        const before = [await teamState(S), await eventState(S.ev.eventId), await eventState(S.flat.eventId)];
        const attempts = await teamWrites(S, S.P.accessToken);
        const breaches = accepted(attempts);
        const after = [await teamState(S), await eventState(S.ev.eventId), await eventState(S.flat.eventId)];
        console.log(`[CVF2A-1] équipe : ${attempts.length} écritures essayées, ${breaches.length} acceptées`);
        console.log(`[CVF2A-1] état de l'équipe avant : ${before[0]}`);
        console.log(`[CVF2A-1] état de l'équipe après : ${after[0]}`);
        assert.deepEqual(breaches, [], `fiche SUSPENDU, écritures de l'équipe acceptées :\n${list(breaches)}`);
        assert.deepEqual(after, before, 'fiche SUSPENDU : l’équipe ou l’événement a changé');
    });

    test('b. la base : fonctions d’équipe avec la partenaire suspendue pour auteur (témoin : acceptées si VALIDE)', async () => {
        const fresh = [await newBuyer('cvf2a-base-neuf-1'), await newBuyer('cvf2a-base-neuf-2')];
        const calls: Array<{ fn: string; p: (i: number) => Row }> = [
            {
                fn: 'event_controller_settings_set', p: (i) => ({
                    actor_id: SB.P.userId, event_id: SB.ev.eventId, controller_id: SB.ctrl.userId, gate_id: i === 0 ? SB.gate1 : SB.gate2,
                    gate_change_allowed: i === 0, entry_point: null, can_accept_cash: i !== 0, reason: null,
                }),
            },
            {
                fn: 'event_controller_gate_set', p: (i) => ({
                    actor_id: SB.P.userId, event_id: SB.ev.eventId, controller_id: SB.ctrl.userId, gate_id: i === 0 ? SB.gate2 : SB.gate1, gate_change_allowed: i === 0,
                }),
            },
            {
                fn: 'controller_invitation_create', p: (i) => ({
                    actor_id: SB.P.userId, actor_role: 'PARTENAIRE', partner_id: SB.P.partnerId, user_id: fresh[i].userId,
                    assignments: [{ event_id: SB.ev.eventId, can_accept_cash: false }], phone_entered: fresh[i].phoneE164, reason: null,
                }),
            },
        ];
        const breaches: string[] = [];
        for (const c of calls) {
            await setFiche(SB.P.partnerId, 'VALIDE');
            const { data: w, error: wErr } = await service.rpc(c.fn, { p: c.p(0) });
            console.log(`[CVF2A-1] témoin ${c.fn} (fiche VALIDE) → ${wErr ? `erreur ${wErr.message}` : JSON.stringify(w).slice(0, 220)}`);
            assert.equal(wErr, null, `${c.fn} (témoin) : ${wErr?.message}`);
            assert.equal((w as Row | null)?.ok, true, `précondition : ${c.fn} acceptée pour une fiche VALIDE (${JSON.stringify(w).slice(0, 300)})`);
            await setFiche(SB.P.partnerId, 'SUSPENDU');
            const before = await teamState(SB);
            const { data, error } = await service.rpc(c.fn, { p: c.p(1) });
            const reply = (data ?? {}) as Row;
            console.log(`[CVF2A-1] ${c.fn} (fiche SUSPENDU) → ${error ? `erreur ${error.message}` : JSON.stringify(reply).slice(0, 220)}`);
            if (!error && reply.ok === true) breaches.push(`${c.fn} → ${JSON.stringify(reply).slice(0, 200)}`);
            else if ((await teamState(SB)) !== before) breaches.push(`${c.fn} : refusée mais l'équipe a changé`);
        }
        assert.deepEqual(breaches, [], `fiche SUSPENDU, fonctions d'équipe acceptées en base :\n${list(breaches)}`);
    });
});

describe('c, d, e. fiche SUSPENDU : caisse, contrôle, transferts', () => {
    test('c. valider l’écart d’une caisse de son événement : refusé', async () => {
        await confirmPassword(SD.P, STRONG_PASSWORD);
        const r = await api('POST', 'partner/shifts/[id]/validate-discrepancy', {
            token: SD.P.accessToken, path: `/api/partner/shifts/${shiftId}/validate-discrepancy`, params: { id: shiftId }, body: {},
        });
        console.log(`[CVF2A-1] POST /api/partner/shifts/[id]/validate-discrepancy → ${show(r)}`);
        const { data } = await service.from('controller_shifts').select('discrepancy_validated_at, discrepancy_validated_by').eq('id', shiftId).single();
        console.log(`[CVF2A-1] caisse ${shiftId} : ${JSON.stringify(data)}`);
        assert.ok(r.status >= 400, `fiche SUSPENDU, écart de caisse validé : ${show(r)}`);
        assert.equal(data?.discrepancy_validated_at ?? null, null, 'écart de caisse validé par une fiche SUSPENDU');
    });

    test('d. contrôle et guichet sur son propre événement : refusés, billet non composté, aucune vente', async () => {
        const breaches: string[] = [];
        const t = SD.P.accessToken;
        const items = [{ categoryId: SD.ev.categories[PAID].id, quantity: 1 }];
        const soldBefore = (await service.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', SD.ev.eventId)).count ?? 0;
        const shiftsBefore = (await service.from('controller_shifts').select('id', { count: 'exact', head: true }).eq('event_id', SD.ev.eventId)).count ?? 0;
        // Écritures : un 2xx (ou un scan « valid ») est une attaque réussie. Lectures (recherche, invités, devis) : sortie
        // brute seulement, la partenaire suspendue garde ses lectures.
        const record = (what: string, r: Reply, write: boolean) => {
            console.log(`[CVF2A-1] ${what} → ${show(r).slice(0, 220)}`);
            if (!write) return;
            if ((r.status >= 200 && r.status < 300 && r.body.result === undefined) || r.body.result === 'valid') breaches.push(`${what} → ${show(r).slice(0, 200)}`);
        };
        record('scan QR (porte 1)', await scanTicket(SD.P, SD.ev.eventId, SD.ticket.id, { gateId: SD.gate1 }), true);
        record('saisie manuelle', await api('POST', 'controller/scan', {
            token: t, body: { eventId: SD.ev.eventId, manualTicketNumber: SD.ticket.number, identityVerified: true, gateId: SD.gate1 }, headers: { 'idempotency-key': randomUUID() },
        }), true);
        record('POST scan/lookup (lecture)', await api('POST', 'controller/scan/lookup', { token: t, body: { eventId: SD.ev.eventId, manualTicketNumber: SD.ticket.number, gateId: SD.gate1 } }), false);
        record('POST scan/guests (lecture)', await api('POST', 'controller/scan/guests', { token: t, body: { eventId: SD.ev.eventId, query: '1234' } }), false);
        record('POST counter-sale/quote (lecture)', await api('POST', 'controller/counter-sale/quote', { token: t, body: { eventId: SD.ev.eventId, items } }), false);
        record('POST counter-sale', await api('POST', 'controller/counter-sale', { token: t, body: { eventId: SD.ev.eventId, items }, headers: { 'idempotency-key': randomUUID() } }), true);
        record('POST controller/gate', await api('POST', 'controller/gate', { token: t, body: { eventId: SD.ev.eventId, gateId: SD.gate2 } }), true);
        const shift = await openShift(SD.P, SD.ev.eventId, 0);
        record('POST shifts/open (PIN du régisseur)', { status: shift.status, body: shift.body as Row }, true);
        assert.equal(await ticketStatus(SD.ticket.id), 'VALIDE', 'billet composté par la propriétaire suspendue');
        const soldAfter = (await service.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', SD.ev.eventId)).count ?? 0;
        const shiftsAfter = (await service.from('controller_shifts').select('id', { count: 'exact', head: true }).eq('event_id', SD.ev.eventId)).count ?? 0;
        assert.deepEqual(breaches, [], `fiche SUSPENDU, contrôle ou guichet accepté sur son événement :\n${list(breaches)}`);
        assert.equal(soldAfter, soldBefore, 'billet vendu au guichet par la propriétaire suspendue');
        assert.equal(shiftsAfter, shiftsBefore, 'caisse ouverte par la propriétaire suspendue');
    });

    test('e. transfert et annulation du transfert d’une invitation : refusés', async () => {
        const breaches: string[] = [];
        const cancel = await api('POST', 'tickets/transfers/[id]/cancel', { token: SD.P.accessToken, path: `/api/tickets/transfers/${transferId}/cancel`, params: { id: transferId }, body: {} });
        console.log(`[CVF2A-1] POST /api/tickets/transfers/[id]/cancel → ${show(cancel)}`);
        if (cancel.status < 300) breaches.push(`annulation du transfert → ${show(cancel)}`);
        const transfer = await api('POST', 'tickets/[id]/transfer', {
            token: SD.P.accessToken, path: `/api/tickets/${invitationTicketId}/transfer`, params: { id: invitationTicketId }, body: { recipient: randomSenegalPhone('77') },
        });
        console.log(`[CVF2A-1] POST /api/tickets/[id]/transfer (invitation) → ${show(transfer)}`);
        if (transfer.status < 300) breaches.push(`transfert de l'invitation → ${show(transfer)}`);
        const { data } = await service.from('ticket_transfers').select('id, status').eq('ticket_id', invitationTicketId);
        console.log(`[CVF2A-1] transferts de l'invitation : ${JSON.stringify(data)}`);
        assert.deepEqual(breaches, [], list(breaches));
        assert.deepEqual((data ?? []).map((x) => [x.id, x.status]), [[transferId, 'PENDING']], 'transfert de l’invitation modifié');
    });
});

describe('f, g, h. fiche SUSPENDU : REST, fonctions et stockage avec son jeton', () => {
    test('f. REST : aucune écriture sur l’événement, ses billets, son équipe', async () => {
        const db = userClient(SD.P.accessToken);
        const ev = SD.ev.eventId;
        const before = [await eventState(ev), await eventState(SD.flat.eventId), await teamState(SD)];
        const breaches: string[] = [];
        const tryWrite = async (what: string, q: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>) => {
            const { data, error } = await q;
            const rows = Array.isArray(data) ? data.length : data ? 1 : 0;
            console.log(`[CVF2A-1] REST ${what} → ${error ? `refus ${error.code ?? ''} ${error.message}` : `${rows} ligne(s)`}`);
            if (!error && rows > 0) breaches.push(`${what} : ${rows} ligne(s)`);
        };
        await tryWrite('events.update(title)', db.from('events').update({ title: 'Titre changé par la REST' }).eq('id', ev).select('id'));
        await tryWrite('events.update(latitude)', db.from('events').update({ latitude: 14.75, longitude: -17.4 }).eq('id', ev).select('id'));
        await tryWrite('events.delete', db.from('events').delete().eq('id', SD.flat.eventId).select('id'));
        await tryWrite('events.insert', db.from('events').insert({ partner_id: SD.P.partnerId, title: 'Créé par la REST', start_date: '2027-01-10', start_time: '20:00', location: 'Salle', city: 'Dakar' }).select('id'));
        await tryWrite('ticket_categories.update', db.from('ticket_categories').update({ total_quantity: 999, price: 1 }).eq('event_id', ev).select('id'));
        await tryWrite('ticket_categories.insert', db.from('ticket_categories').insert({ event_id: ev, name: 'REST', price: 0, total_quantity: 5 }).select('id'));
        await tryWrite('ticket_categories.delete', db.from('ticket_categories').delete().eq('event_id', ev).select('id'));
        await tryWrite('tickets.update', db.from('tickets').update({ status: 'ANNULE' }).eq('event_id', ev).select('id'));
        await tryWrite('tickets.insert', db.from('tickets').insert({ event_id: ev, category_id: SD.ev.categories[FREE].id, price: 0, status: 'VALIDE', ticket_number: `TCK-REST-${Date.now()}`, qr_code: randomUUID() }).select('id'));
        await tryWrite('event_zones.delete', db.from('event_zones').delete().eq('event_id', ev).select('id'));
        await tryWrite('event_gates.delete', db.from('event_gates').delete().eq('event_id', ev).select('id'));
        await tryWrite('event_controllers.update', db.from('event_controllers').update({ can_accept_cash: true, gate_id: SD.gate2 }).eq('event_id', ev).select('id'));
        await tryWrite('event_controllers.delete', db.from('event_controllers').delete().eq('event_id', ev).select('id'));
        await tryWrite('event_controllers.insert', db.from('event_controllers').insert({ event_id: SD.flat.eventId, user_id: SD.invited.userId, created_by: SD.P.userId }).select('id'));
        await tryWrite('controller_invitations.update', db.from('controller_invitations').update({ status: 'EXPIRED' }).eq('partner_id', SD.P.partnerId).select('id'));
        await tryWrite('event_regisseur_pins.insert', db.from('event_regisseur_pins').insert({ event_id: SD.flat.eventId, pin_hash: 'rest' }).select('event_id'));
        await tryWrite('event_regisseur_pins.delete', db.from('event_regisseur_pins').delete().eq('event_id', ev).select('event_id'));
        await tryWrite('ticket_transfers.update', db.from('ticket_transfers').update({ status: 'CANCELLED' }).eq('id', transferId).select('id'));
        const after = [await eventState(ev), await eventState(SD.flat.eventId), await teamState(SD)];
        assert.deepEqual(breaches, [], `fiche SUSPENDU, écritures REST acceptées :\n${list(breaches)}`);
        assert.deepEqual(after, before, 'fiche SUSPENDU : la REST a changé l’événement, ses billets ou son équipe');
    });

    test('g. toute fonction exécutable par authenticated, appelée avec son jeton : rien ne change', async () => {
        const fns = await inspect(async (c) => (await c.query<{ proname: string; args: string }>(`
            SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
              FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.prorettype <> 'trigger'::regtype AND p.prokind = 'f'
               AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
             ORDER BY 1, 2`)).rows);
        console.log(`[CVF2A-1] fonctions exécutables par authenticated : ${fns.map((f) => `${f.proname}(${f.args})`).join(', ')}`);
        const ev = SD.ev.eventId;
        const payload: Row = {
            event_id: ev, actor_id: SD.P.userId, user_id: SD.P.userId, partner_id: SD.P.partnerId, controller_id: SD.ctrl.userId,
            ticket_id: SD.ticket.id, category_id: SD.ev.categories[FREE].id, gate_id: SD.gate2, can_accept_cash: true,
            patch: { title: 'Titre changé par une fonction' }, title: 'Titre changé par une fonction', to_status: 'ANNULE',
        };
        const before = [await eventState(ev), await teamState(SD)];
        const db = userClient(SD.P.accessToken);
        for (const f of fns) {
            const body: Row = {};
            for (const part of f.args.split(',').map((x) => x.trim()).filter(Boolean)) {
                const [argName, ...type] = part.split(/\s+/);
                const t = type.join(' ');
                body[argName] = t === 'jsonb' || t === 'json' ? payload : t === 'uuid' ? ev : t === 'boolean' ? true : t === 'text' ? 'x' : t === 'integer' ? 1 : null;
            }
            const r = await restRpc(db, f.proname, body);
            console.log(`[CVF2A-1] rpc ${f.proname} → ${r.ok ? `exécutée : ${JSON.stringify(r.data).slice(0, 120)}` : `refus ${r.error}`}`);
        }
        const after = [await eventState(ev), await teamState(SD)];
        assert.deepEqual(after, before, 'fiche SUSPENDU : une fonction appelée avec son jeton a changé l’événement ou l’équipe');
    });

    test('h. stockage avec son jeton : déposer, remplacer, effacer une affiche, refusé', async () => {
        const storage = userClient(SD.P.accessToken).storage.from(BUCKET);
        const webp = await sharp({ create: { width: 32, height: 20, channels: 3, background: { r: 200, g: 0, b: 0 } } }).webp().toBuffer();
        const breaches: string[] = [];
        const up = await storage.upload(`events/${SD.P.partnerId}/${uniqueName('webp')}`, webp, { contentType: 'image/webp', upsert: false });
        console.log(`[CVF2A-1] stockage : dépôt direct → ${up.error ? `refus ${up.error.message}` : JSON.stringify(up.data)}`);
        if (!up.error) breaches.push(`dépôt direct accepté : ${JSON.stringify(up.data)}`);
        const over = await storage.upload(ownPosterPath, webp, { contentType: 'image/webp', upsert: true });
        console.log(`[CVF2A-1] stockage : remplacement de l'affiche citée → ${over.error ? `refus ${over.error.message}` : JSON.stringify(over.data)}`);
        if (!over.error) breaches.push(`affiche citée remplacée : ${JSON.stringify(over.data)}`);
        const rm = await storage.remove([ownPosterPath]);
        console.log(`[CVF2A-1] stockage : effacement de l'affiche citée → ${rm.error ? `refus ${rm.error.message}` : JSON.stringify(rm.data)}`);
        const { data: still } = await service.storage.from(BUCKET).download(ownPosterPath);
        if (!still) breaches.push('affiche citée effacée par la partenaire suspendue');
        assert.deepEqual(breaches, [], list(breaches));
    });
});

/** Routes d'écriture de /api/partner/events (fichiers du disque), avec des paramètres concrets de `m`. */
async function eventWrites(m: Mount, token: string): Promise<Attempt[]> {
    const root = path.join(process.cwd(), 'app', 'api', 'partner', 'events');
    const rels: string[] = [];
    const walk = (dir: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.name === 'route.ts') rels.push(`events${path.relative(root, dir) ? `/${path.relative(root, dir).split(path.sep).join('/')}` : ''}`);
        }
    };
    walk(root);
    const out: Attempt[] = [];
    out.push({ what: 'PUT events/[id] (modification valide, version lue)', reply: await putEvent(token, m.ev.eventId, { title: 'Titre changé (fiche non validée)' }) });
    for (const rel of rels.sort()) {
        const mod = (await import(`../../app/api/partner/${rel}/route`)) as Record<string, unknown>;
        for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
            if (typeof mod[method] !== 'function' || `${method} ${rel}` === 'POST events/[id]/participants-export') continue;
            const params: Record<string, string> = {};
            const url = `/api/partner/${rel.split('/').map((s) => {
                const k = /^\[(\w+)\]$/.exec(s)?.[1];
                if (!k) return s;
                params[k] = k === 'id' ? m.ev.eventId : k === 'categoryId' ? m.ev.categories[FREE].id : k === 'ticketId' ? m.ticket.id : randomUUID();
                return params[k];
            }).join('/')}`;
            const reply = await api(method, `partner/${rel}`, { token, path: url, params, body: { title: 'Titre changé', to: 'EN_ATTENTE', name: 'Nouvelle', price: 0, total_quantity: 5, confirm: true } });
            console.log(`[CVF2A] ${method} ${url} → ${show(reply).slice(0, 200)}`);
            out.push({ what: `${method} ${rel}`, reply });
        }
    }
    return out;
}

describe('i. fiche EN_ATTENTE puis REJETE', () => {
    for (const status of ['EN_ATTENTE', 'REJETE'] as const) {
        test(`fiche ${status} : équipe, événement, dépôt d’image et contrôle refusés, rien ne change`, async () => {
            const m = await mount(`fiche-${status.toLowerCase()}`);
            await setFiche(m.P.partnerId, status);
            try {
                const before = [await teamState(m), await eventState(m.ev.eventId), await eventState(m.flat.eventId)];
                const attempts: Attempt[] = [];
                attempts.push(...await eventWrites(m, m.P.accessToken));
                const img = await uploadImage(m.P.accessToken, await sharp({ create: { width: 40, height: 25, channels: 3, background: { r: 0, g: 0, b: 200 } } }).png().toBuffer(), 'a.png', 'image/png');
                console.log(`[CVF2A] POST /api/partner/upload → ${show(img).slice(0, 200)}`);
                attempts.push({ what: 'POST upload', reply: img });
                const sc = await scanTicket(m.P, m.ev.eventId, m.ticket.id, { gateId: m.gate1 });
                console.log(`[CVF2A] scan de la propriétaire → ${show(sc).slice(0, 200)}`);
                attempts.push({ what: 'scan de la propriétaire', reply: sc.body.result === 'valid' ? { status: 200, body: sc.body } : { status: 403, body: sc.body } });
                attempts.push(...await teamWrites(m, m.P.accessToken));
                const breaches = accepted(attempts);
                const after = [await teamState(m), await eventState(m.ev.eventId), await eventState(m.flat.eventId)];
                console.log(`[CVF2A-1] fiche ${status} : ${attempts.length} écritures essayées, ${breaches.length} acceptées`);
                assert.deepEqual(breaches, [], `fiche ${status}, écritures acceptées :\n${list(breaches)}`);
                assert.deepEqual(after, before, `fiche ${status} : l'équipe ou l'événement a changé`);
            } finally {
                await setFiche(m.P.partnerId, 'VALIDE');
            }
        });
    }
});

describe('j. fiche réactivée : tout revient', () => {
    async function writesWork(m: Mount, token: string, label: string): Promise<string[]> {
        const failures: string[] = [];
        const check = (what: string, r: Reply, ok: (r: Reply) => boolean) => {
            console.log(`[CVF2A-1] ${label} : ${what} → ${show(r).slice(0, 200)}`);
            if (!ok(r)) failures.push(`${what} → ${show(r).slice(0, 200)}`);
        };
        const two = (r: Reply) => r.status >= 200 && r.status < 300;
        // Événement sans zones pour l'événement, ses catégories, ses invitations et son code (une catégorie ajoutée à un
        // événement à zones dépend de la configuration des zones) ; l'événement à portes pour l'équipe
        const ev = m.flat.eventId;
        check('PUT events/[id] (titre)', await putEvent(token, ev, { title: `Titre rétabli ${label}` }), two);
        check('POST categories', await api('POST', 'partner/events/[id]/categories', {
            token, path: `/api/partner/events/${ev}/categories`, params: { id: ev }, body: { name: `Carré ${Date.now() % 100000}`, price: 5_000, total_quantity: 5, max_per_order: 2 },
        }), two);
        check('POST invitations (billet)', await api('POST', 'partner/events/[id]/invitations', {
            token, path: `/api/partner/events/${ev}/invitations`, params: { id: ev },
            body: { category_id: m.flat.categories[FREE].id, phones: [randomSenegalPhone('77')], quantity: 1 },
        }), two);
        check('POST regisseur-pin', await api('POST', 'partner/events/[id]/regisseur-pin', {
            token, path: `/api/partner/events/${ev}/regisseur-pin`, params: { id: ev }, body: { confirm: true, confirmOpenShifts: true },
        }), two);
        check('POST upload', await uploadImage(token, await sharp({ create: { width: 40, height: 25, channels: 3, background: { r: 0, g: 120, b: 0 } } }).png().toBuffer(), 'b.png', 'image/png'), two);
        check('PATCH team/settings', await api('PATCH', 'partner/team/settings', {
            token, body: { eventId: m.ev.eventId, controllerId: m.ctrl.userId, gateId: m.gate2, gateChangeAllowed: false, canAcceptCash: true },
        }), two);
        check('POST team/invite', await api('POST', 'partner/team/invite', {
            token, body: { event_ids: [m.ev.eventId], phone: (await newBuyer(`cvf2a-${label}-neuf`)).phoneE164, confirm_promotion: true },
        }), two);
        return failures;
    }

    test('fiche SUSPENDU puis VALIDE (directement) : écritures de nouveau acceptées, route et base', async () => {
        const m = await mount('reactivee');
        await setFiche(m.P.partnerId, 'SUSPENDU');
        const refused = await putEvent(m.P.accessToken, m.flat.eventId, { title: 'Pendant la suspension' });
        assert.equal(refused.body.code, 'PARTNER_SUSPENDED', `précondition : fiche suspendue refusée (${show(refused)})`);
        await setFiche(m.P.partnerId, 'VALIDE');
        const failures = await writesWork(m, m.P.accessToken, 'réactivée');
        const { data } = await service.rpc('event_update', { p: { event_id: m.flat.eventId, actor_id: m.P.userId, patch: { title: 'Titre par la base' }, expected_updated_at: await versionOf(m.flat.eventId) } });
        console.log(`[CVF2A-1] réactivée : event_update (base) → ${JSON.stringify(data).slice(0, 200)}`);
        if ((data as Row | null)?.ok !== true) failures.push(`event_update (base) → ${JSON.stringify(data).slice(0, 200)}`);
        assert.deepEqual(failures, [], `fiche réactivée, écritures encore refusées :\n${list(failures)}`);
    });

    test('suspension puis réactivation par partner_status_set, reconnexion : événement rétabli, écritures acceptées', async () => {
        const m = await mount('reactivee-admin');
        const sa = await newAdmin('cvf2a-superadmin', [], { role: 'SUPERADMIN' });
        const susp = await service.rpc('partner_status_set', { p: { partner_id: m.P.partnerId, actor_id: sa.userId, status: 'SUSPENDU', reason: 'Contre-vérification de la finition 2a' } });
        console.log(`[CVF2A-1] partner_status_set SUSPENDU → ${susp.error ? susp.error.message : JSON.stringify(susp.data).slice(0, 300)}`);
        assert.equal((susp.data as Row | null)?.ok, true, `suspension (montage) : ${JSON.stringify(susp.data ?? susp.error)}`);
        const { data: evSusp } = await service.from('events').select('status').eq('id', m.ev.eventId).single();
        const back = await service.rpc('partner_status_set', { p: { partner_id: m.P.partnerId, actor_id: sa.userId, status: 'VALIDE', reason: null } });
        console.log(`[CVF2A-1] partner_status_set VALIDE → ${back.error ? back.error.message : JSON.stringify(back.data).slice(0, 300)}`);
        assert.equal((back.data as Row | null)?.ok, true, `réactivation (montage) : ${JSON.stringify(back.data ?? back.error)}`);
        const { data: evBack } = await service.from('events').select('status').eq('id', m.ev.eventId).single();
        console.log(`[CVF2A-1] statut de l'événement : pendant ${evSusp?.status}, après ${evBack?.status}`);
        assert.equal(evBack?.status, 'PUBLIE', 'événement non rétabli après la réactivation');
        const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: s, error: sErr } = await anon.auth.signInWithPassword({ email: await gotrueEmail(m.P.email), password: STRONG_PASSWORD });
        assert.equal(sErr, null, `reconnexion : ${sErr?.message}`);
        await stepUpTestSession(s.session!.access_token);
        const failures = await writesWork(m, s.session!.access_token, 'réactivée par l’admin');
        assert.deepEqual(failures, [], `fiche réactivée par l'administration, écritures encore refusées :\n${list(failures)}`);
    });
});

