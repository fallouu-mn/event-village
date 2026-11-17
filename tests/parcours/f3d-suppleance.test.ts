/**
 * Finition 3d (recours et suppléance) — point 4, l'administration à la place d'une organisatrice.
 *
 * 4b. Page Équipe d'un admin : l'organisatrice se choisit dans une liste avec recherche (fini « ?partnerId= » tapé à la
 *     main) : GET /api/partner/team/organizers?q= — admin muni de events.read (le droit qui ouvre la lecture de l'équipe) ;
 *     recherche sans tenir compte des accents ni des majuscules (nom commercial, raison sociale, ville, titulaire) ;
 *     organisatrices validées ou suspendues seulement ; 20 au plus. Une organisatrice, un admin sans events.read, un
 *     appel sans session : refusés.
 * Fin de suite : assertFinition3dInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { assertFinition3dInvariants } from '../helpers/finition3d-invariants';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { newAdmin, type TestAdmin } from './notif-helpers';
import { importModule, service } from './paiement-helpers';

type Handler = (req: NextRequest) => Promise<Response>;
interface Organizer { partner_id: string; name: string; city: string | null; status: string }

const TOKEN = randomBytes(3).toString('hex');
let reader: TestAdmin;
let organizer: TestPartner;
let suspended: TestPartner;

async function organizersRoute(): Promise<Handler> {
    const mod = (await importModule('../../app/api/partner/team/organizers/route')) as { GET?: Handler };
    assert.equal(typeof mod.GET, 'function', 'GET /api/partner/team/organizers absente');
    return mod.GET as Handler;
}

before(async () => {
    reader = await newAdmin('f3d-equipe-lecteur', ['events.read']);
    organizer = await newPartner(`f3d-equipe-${TOKEN}`);
    suspended = await newPartner(`f3d-equipe-susp-${TOKEN}`);
    const { error } = await service.from('partners').update({ commercial_name: `Gorée Événements ${TOKEN}`, city: 'Saint-Louis' }).eq('id', organizer.partnerId);
    assert.equal(error, null, error?.message);
    const { error: sErr } = await service.from('partners').update({ commercial_name: `Thiès Spectacles ${TOKEN}`, status: 'SUSPENDU' }).eq('id', suspended.partnerId);
    assert.equal(sErr, null, sErr?.message);
});

after(async () => {
    await assertFinition3dInvariants('f3d-suppleance');
});

describe('4b. Équipe d’un admin : choix de l’organisatrice par une liste avec recherche', () => {
    test('admin events.read : recherche sans accents ni majuscules, nom et ville rendus', async () => {
        const GET = await organizersRoute();
        const res = await GET(jsonRequest(`/api/partner/team/organizers?q=${encodeURIComponent(`GOREE evenements ${TOKEN}`)}`, 'GET', reader.accessToken));
        const body = (await res.json()) as { organizers?: Organizer[] };
        assert.equal(res.status, 200, JSON.stringify(body));
        assert.deepEqual(body.organizers?.map((o) => [o.partner_id, o.name, o.city, o.status]),
            [[organizer.partnerId, `Gorée Événements ${TOKEN}`, 'Saint-Louis', 'VALIDE']]);
    });

    test('une organisatrice suspendue reste dans la liste (l’admin agit à sa place), statut rendu', async () => {
        const GET = await organizersRoute();
        const res = await GET(jsonRequest(`/api/partner/team/organizers?q=${encodeURIComponent(`thies ${TOKEN}`)}`, 'GET', reader.accessToken));
        const body = (await res.json()) as { organizers?: Organizer[] };
        assert.equal(res.status, 200, JSON.stringify(body));
        assert.deepEqual(body.organizers?.map((o) => [o.partner_id, o.status]), [[suspended.partnerId, 'SUSPENDU']]);
    });

    test('sans recherche : 20 organisatrices au plus, triées par nom', async () => {
        const GET = await organizersRoute();
        const res = await GET(jsonRequest('/api/partner/team/organizers', 'GET', reader.accessToken));
        const body = (await res.json()) as { organizers?: Organizer[]; truncated?: boolean };
        assert.equal(res.status, 200, JSON.stringify(body).slice(0, 300));
        const names = (body.organizers ?? []).map((o) => o.name);
        assert.ok(names.length > 0 && names.length <= 20, `nombre rendu : ${names.length}`);
        assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })));
        assert.equal(typeof body.truncated, 'boolean');
    });

    test('refus : admin sans events.read (403 PERMISSION_MISSING), organisatrice (403), sans session (401)', async () => {
        const GET = await organizersRoute();
        const noRight = await newAdmin('f3d-equipe-sans-droit', ['users.read']);
        const r1 = await GET(jsonRequest('/api/partner/team/organizers', 'GET', noRight.accessToken));
        const b1 = (await r1.json()) as { code?: string; permission?: string };
        assert.deepEqual([r1.status, b1.code, b1.permission], [403, 'PERMISSION_MISSING', 'events.read'], JSON.stringify(b1));
        const r2 = await GET(jsonRequest('/api/partner/team/organizers', 'GET', organizer.accessToken));
        assert.equal(r2.status, 403, await r2.text());
        const r3 = await GET(jsonRequest('/api/partner/team/organizers', 'GET', null));
        assert.equal(r3.status, 401, await r3.text());
    });
});
