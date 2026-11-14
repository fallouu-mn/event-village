/**
 * Contre-vérification du lot 9 quinquies, attaque 4 — partenaire dont la fiche n'est pas validée (A9).
 *
 * Partenaire validée, avec un événement publié, dont la fiche est remise EN_ATTENTE (puis REJETE). Elle essaie :
 *  a. fiche REJETE : toutes les routes /api/partner (toutes méthodes), hors le complément de dossier et ses lectures ;
 *  b. transition de son événement avec un corps valable, vers chaque statut (annulation, retrait, suspension…) ;
 *  c. PostgREST : lecture de l'historique de son événement (réservée à la propriétaire), écritures sur ses tables ;
 *  d. observation (sans assertion) : la même partenaire, aussi CONTRÔLEUR affectée à son propre événement, scanne.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { service } from '../parcours/paiement-helpers';
import { createPartnerEvent, newPartner, type TestPartner } from '../parcours/finance-helpers';
import { assignController } from '../parcours/acces-helpers';
import { callRoute, userClient } from './cv9qq-helpers';

const ROOT = path.join(process.cwd(), 'app', 'api', 'partner');
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const PUBLIC_ROUTES = new Set(['register', 'documents/upload']);
/** Liste blanche d'une fiche REJETE (lib/auth/partner-fiche-guard.ts, READ_REJECTED). */
const REJECTED_ALLOWED = new Set(['GET dashboard', 'GET documents/signed-url', 'POST dossier/complete']);

let partner: TestPartner;
let eventId: string;

before(async () => {
    partner = await newPartner('cv9qq-fiche');
    eventId = (await createPartnerEvent(partner.partnerId, 'cv9qq', [{ name: 'Standard', price: 5_000, total: 20 }])).eventId;
});

after(async () => {
    await setFiche('VALIDE');
    await assertLot9quinquiesInvariants('cv9qq-4-partenaire-en-attente');
});

async function setFiche(status: 'VALIDE' | 'EN_ATTENTE' | 'REJETE'): Promise<void> {
    const { error } = await service.from('partners').update({ status, ...(status === 'REJETE' ? { rejection_reason: 'Pièces illisibles (contre-vérification)' } : {}) }).eq('id', partner.partnerId);
    assert.equal(error, null, `fiche ${status} : ${error?.message}`);
}

function partnerRoutes(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.name === 'route.ts') out.push(path.relative(ROOT, dir).split(path.sep).join('/'));
        }
    };
    walk(ROOT);
    return out.sort();
}

function concrete(rel: string): { url: string; params: Record<string, string> } {
    const params: Record<string, string> = {};
    const segs = rel.split('/').map((s) => {
        const m = /^\[(\w+)\]$/.exec(s);
        if (!m) return s;
        params[m[1]] = m[1] === 'id' || m[1] === 'eventId' ? eventId : randomUUID();
        return params[m[1]];
    });
    return { url: `http://127.0.0.1:3000/api/partner/${segs.join('/')}?eventId=${eventId}`, params };
}

async function eventStatus(): Promise<string> {
    const { data, error } = await service.from('events').select('status').eq('id', eventId).single();
    assert.equal(error, null, error?.message);
    return String(data.status);
}

describe('Attaque 4 — partenaire dont la fiche n\'est pas validée', () => {
    test('a. fiche REJETE : toute route /api/partner hors liste blanche → 403 PARTNER_NOT_VALIDATED', async () => {
        await setFiche('REJETE');
        const open: string[] = [];
        for (const rel of partnerRoutes()) {
            if (PUBLIC_ROUTES.has(rel)) continue;
            for (const method of METHODS) {
                const { url, params } = concrete(rel);
                const r = await callRoute(`partner/${rel}`, method, { token: partner.accessToken, params, url });
                if (!r) continue;
                const key = `${method} ${rel}`;
                if (REJECTED_ALLOWED.has(key)) continue;
                if (!(r.status === 403 && r.body.code === 'PARTNER_NOT_VALIDATED')) open.push(`${key} → ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
            }
        }
        assert.deepEqual(open, [], `routes ouvertes à une fiche REJETE :\n${open.join('\n')}`);
    });

    test('b. fiche EN_ATTENTE : transition de son événement, corps valable, vers chaque statut → refusée, statut inchangé', async () => {
        await setFiche('EN_ATTENTE');
        const before = await eventStatus();
        const outcomes: string[] = [];
        for (const to of ['ANNULE', 'SUSPENDU', 'BROUILLON', 'EN_ATTENTE', 'VALIDE', 'PUBLIE', 'TERMINE']) {
            const r = await callRoute('partner/events/[id]/transition', 'POST', {
                token: partner.accessToken, params: { id: eventId }, url: `http://127.0.0.1:3000/api/partner/events/${eventId}/transition`,
                body: { to, reason: 'Contre-vérification : motif assez long pour la règle.' },
            });
            outcomes.push(`${to}:${r?.status}/${String(r?.body.code ?? '')}`);
        }
        console.log(`[CV9QQ-4b] transitions d'une fiche EN_ATTENTE (événement ${before}) : ${outcomes.join(' ')}`);
        assert.deepEqual(outcomes.filter((o) => !o.endsWith(':403/PARTNER_NOT_VALIDATED')), [], 'une transition passe la garde');
        assert.equal(await eventStatus(), before, 'statut de l\'événement inchangé');
    });

    test('c. fiche EN_ATTENTE : PostgREST ne sert plus l\'historique de son événement et refuse toute écriture', async () => {
        await setFiche('VALIDE');
        const db = userClient(partner.accessToken);
        const historyValid = (await db.from('event_status_history').select('id').eq('event_id', eventId)).data ?? [];
        assert.ok(historyValid.length > 0, 'témoin : fiche VALIDE, historique de son événement lisible');

        await setFiche('EN_ATTENTE');
        const history = (await db.from('event_status_history').select('id').eq('event_id', eventId)).data ?? [];
        assert.equal(history.length, 0, 'fiche EN_ATTENTE : historique de son événement illisible');

        const writes: string[] = [];
        const upd = await db.from('events').update({ title: 'Titre changé par la REST' }).eq('id', eventId).select('id');
        writes.push(`events.update:${upd.error ? upd.error.code : `${(upd.data ?? []).length} ligne(s)`}`);
        const cat = await db.from('ticket_categories').insert({ event_id: eventId, name: 'Pirate', price: 0, total_quantity: 1000 }).select('id');
        writes.push(`ticket_categories.insert:${cat.error ? cat.error.code : `${(cat.data ?? []).length} ligne(s)`}`);
        const prod = await db.from('products').insert({ partner_id: partner.partnerId, name: 'Pirate', price: 1 }).select('id');
        writes.push(`products.insert:${prod.error ? prod.error.code : `${(prod.data ?? []).length} ligne(s)`}`);
        const del = await db.from('partner_activities').delete().eq('partner_id', partner.partnerId).select('partner_id');
        writes.push(`partner_activities.delete:${del.error ? del.error.code : `${(del.data ?? []).length} ligne(s)`}`);
        console.log(`[CV9QQ-4c] écritures REST d'une fiche EN_ATTENTE : ${writes.join(' ; ')}`);
        assert.deepEqual(writes.filter((w) => /:[1-9]\d* ligne/.test(w)), [], 'une écriture REST a abouti');
    });

    test('d. observation : partenaire EN_ATTENTE aussi contrôleuse de son propre événement, scan', async () => {
        await setFiche('EN_ATTENTE');
        const { error: roleErr } = await service.from('user_roles').upsert([{ user_id: partner.userId, role: 'CONTROLEUR' }], { onConflict: 'user_id,role' });
        assert.equal(roleErr, null, roleErr?.message);
        try {
            await assignController(partner, partner.userId, eventId, false);
            const r = await callRoute('controller/scan', 'POST', { token: partner.accessToken, body: { eventId, manualTicketNumber: 'EV-0000-0000' }, headers: { 'idempotency-key': randomUUID() } });
            console.log(`[CV9QQ-4d] observation : scan par la partenaire EN_ATTENTE affectée comme contrôleuse : ${r?.status} ${String(r?.body.code ?? r?.body.result ?? '')}`);
        } finally {
            await service.from('event_controllers').delete().eq('event_id', eventId).eq('user_id', partner.userId);
            await service.from('user_roles').delete().eq('user_id', partner.userId).eq('role', 'CONTROLEUR');
        }
    });
});
