/**
 * Finition 2b (D, E-25) — fiche admin de validation : couleurs, consignes, portes et zones visibles. Mon état des lieux
 * du 15/11 (point 5) : « Pas non plus de couleurs, de consignes ni de zones ».
 *  a. GET /api/admin/events/[id] (admin events.read) : chaque catégorie avec sa couleur au contrôle et sa consigne
 *     d'entrée ; les zones (nom, type, catégories admises, portes), dans l'ordre de l'éditeur.
 *  b. Fiche : colonne « Au contrôle » (pastille, nom de la couleur, consigne), section « Contrôle à l'entrée » (zones et
 *     portes, ou « Une seule entrée : … »).
 * Rouge avant le correctif : zones absentes de la réponse ; fiche sans couleur, consigne ni zone. Sortie brute `[F2B-D1]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { importModule, service } from './paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { newAdmin, type TestAdmin } from './notif-helpers';
import { routeContext } from './helpers';
import { createZonedEvent } from './zones-helpers';
import { advanceEventTo } from './cycle-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
const ROOT = process.cwd();

let P: TestPartner;
let reader: TestAdmin;

before(async () => {
    P = await newPartner('f2b-fiche');
    reader = await newAdmin('f2b-fiche-lecteur', ['events.read']);
});

after(async () => {
    await assertFinition1Invariants('f2b-fiche-admin');
});

describe('a. la fiche sert couleurs, consignes, zones et portes', () => {
    test('événement en attente de validation, deux zones', async () => {
        const ev = await createZonedEvent(P, 'f2b-fiche', [{ name: 'Standard', price: 0, total: 50 }, { name: 'VIP', price: 0, total: 10 }], [
            { name: 'Entrée générale', kind: 'ENTREE', admits: ['Standard', 'VIP'], gates: ['Porte Nord', 'Porte Sud'] },
            { name: 'Carré VIP', kind: 'CONTROLE', admits: ['VIP'], gates: ['Accès carré'] },
        ], { status: 'BROUILLON', startsInHours: 96 });
        const { error } = await service.from('ticket_categories').update({ scan_color: 'OR', entry_instruction: 'Remettre bracelet doré' }).eq('id', ev.categories.VIP.id);
        assert.equal(error, null, error?.message);
        await advanceEventTo(ev.eventId, 'EN_ATTENTE', { partnerUserId: P.userId });

        const mod = await importModule('../../app/api/admin/events/[id]/route');
        const res = await (mod.GET as Handler)(jsonRequest(`/api/admin/events/${ev.eventId}`, 'GET', reader.accessToken), routeContext({ id: ev.eventId }));
        const body = (await res.json()) as Row;
        assert.equal(res.status, 200, JSON.stringify(body).slice(0, 600));
        const cats = Object.fromEntries(((body.categories ?? []) as Row[]).map((c) => [String(c.name), { scan_color: c.scan_color, entry_instruction: c.entry_instruction }]));
        const names = new Map(((body.categories ?? []) as Row[]).map((c) => [String(c.id), String(c.name)]));
        const zones = ((body.zones ?? []) as Row[]).map((z) => ({
            name: z.name, kind: z.kind,
            admits: ((z.category_ids ?? []) as string[]).map((id) => names.get(id)).sort(),
            gates: ((z.gates ?? []) as Row[]).map((g) => g.name),
        }));
        console.log(`[F2B-D1] fiche : catégories ${JSON.stringify(cats)} ; zones ${JSON.stringify(zones)}`);
        assert.deepEqual(cats.VIP, { scan_color: 'OR', entry_instruction: 'Remettre bracelet doré' });
        assert.equal(cats.Standard.scan_color, 'BLANC', 'couleur posée par la base');
        assert.deepEqual(zones, [
            { name: 'Entrée générale', kind: 'ENTREE', admits: ['Standard', 'VIP'], gates: ['Porte Nord', 'Porte Sud'] },
            { name: 'Carré VIP', kind: 'CONTROLE', admits: ['VIP'], gates: ['Accès carré'] },
        ]);
    });
});

describe('b. fiche : « Au contrôle » et « Contrôle à l’entrée »', () => {
    const page = fs.readFileSync(path.join(ROOT, 'app/admin/events/[id]/page.tsx'), 'utf8');
    test('colonne « Au contrôle » (pastille, couleur, consigne) ; section des zones et portes', () => {
        assert.match(page, /header: 'Au contrôle'/);
        assert.match(page, /ScanColorDot/);
        assert.match(page, /entry_instruction/);
        assert.match(page, /title="Contrôle à l’entrée"/);
        assert.match(page, /SINGLE_ENTRANCE_TEXT/);
    });
});
