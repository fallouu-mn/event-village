/**
 * Lot Carte B3 — décision du client du 25/11 (contre-vérification de la carte B3, T2) : la raison sociale (nom légal)
 * n'est jamais montrée au public. Le nom commercial devient obligatoire à l'inscription et dans le profil ; une
 * partenaire d'avant l'obligation, sans nom commercial, est montrée comme « Partenaire Event Village ».
 *  A. Repli : fiche d'une salle, d'un établissement et d'un événement d'une partenaire sans nom commercial → « Partenaire
 *     Event Village », jamais la raison sociale ; avec un nom commercial → ce nom.
 *  B. Obligation : schéma de l'inscription (écran et route) sans nom commercial refusé ; profil : nom commercial vidé
 *     refusé (400, champ commercial_name), rien d'écrit ; un nom valable est enregistré.
 * Base locale seulement (garde-fou des tests).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { api, show } from '../audit/cvf1-helpers';
import { service } from './paiement-helpers';
import { newPartner, superadminId, type TestPartner } from './finance-helpers';
import { newHall, openHallsService } from './l10a-helpers';
import { newTable, newVenue, openTablesService } from './l11a-helpers';
import { createDraftEvent, rpcTransition } from './cycle-helpers';
import { PARTNER_FALLBACK_NAME, partnerPublicName } from '../../lib/partner/public-name';
import { publicHall } from '../../lib/halls/queries';
import { publicVenue } from '../../lib/tables/queries';
import { RegisterPartnerFieldsSchema } from '../../lib/validations/auth';

const TOKEN = `cb3nc${randomBytes(4).toString('hex')}`;
const LEGAL = `Raison Legale ${TOKEN} SARL`;

let restoreHalls: () => Promise<void>;
let restoreTables: () => Promise<void>;
let owner: TestPartner;
let hallId: string;
let venueId: string;

async function setNames(commercial: string | null): Promise<void> {
    const { error } = await service.from('partners').update({ commercial_name: commercial, company_name: LEGAL }).eq('id', owner.partnerId);
    assert.equal(error, null, error?.message);
}

before(async () => {
    restoreHalls = await openHallsService();
    restoreTables = await openTablesService();
    owner = await newPartner('cb3-nom');
    hallId = await newHall(owner);
    venueId = await newVenue(owner);
    await newTable(owner, venueId, 4);
});

after(async () => {
    await restoreHalls();
    await restoreTables();
});

describe('A — nom montré au public : nom commercial, sinon « Partenaire Event Village »', () => {
    test('règle partagée (lib/partner/public-name.ts)', () => {
        assert.equal(partnerPublicName({ commercial_name: '  Chez Awa  ' }), 'Chez Awa');
        for (const p of [{ commercial_name: null }, { commercial_name: '   ' }, null, undefined]) assert.equal(partnerPublicName(p), PARTNER_FALLBACK_NAME);
        assert.equal(PARTNER_FALLBACK_NAME, 'Partenaire Event Village');
    });

    test('sans nom commercial : salle, établissement et événement → « Partenaire Event Village », jamais la raison sociale', async () => {
        await setNames(null);
        const hall = await publicHall(hallId);
        const venue = await publicVenue(venueId);
        const d = await createDraftEvent(owner, 'cb3-nom', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 72 });
        const admin = await superadminId();
        for (const [actor, to] of [[owner.userId, 'EN_ATTENTE'], [admin, 'VALIDE'], [owner.userId, 'PUBLIE']] as const) {
            const r = await rpcTransition(d.eventId, actor, to);
            assert.equal(r.data?.ok, true, `${to} : ${JSON.stringify(r.data)}`);
        }
        const sheet = await api('GET', 'events/[id]', { params: { id: d.eventId }, path: `/api/events/${d.eventId}` });
        assert.equal(sheet.status, 200, show(sheet));
        console.log(`[CB3-NOM] salle : ${hall?.partnerName} ; établissement : ${venue?.partnerName} ; fiche : ${JSON.stringify((sheet.body.event as Record<string, unknown>)?.organizer)}`);
        assert.deepEqual([hall?.partnerName, venue?.partnerName], [PARTNER_FALLBACK_NAME, PARTNER_FALLBACK_NAME]);
        assert.ok(JSON.stringify(sheet.body).includes(PARTNER_FALLBACK_NAME), `fiche sans « ${PARTNER_FALLBACK_NAME} » : ${show(sheet)}`);
        for (const [what, body] of [['salle', hall], ['établissement', venue], ['fiche de l’événement', sheet.body]] as const) {
            assert.ok(!JSON.stringify(body).includes(LEGAL), `${what} : raison sociale rendue`);
        }
    });

    test('avec un nom commercial : ce nom, jamais la raison sociale', async () => {
        const name = `Enseigne ${TOKEN}`;
        await setNames(name);
        const hall = await publicHall(hallId);
        const venue = await publicVenue(venueId);
        assert.deepEqual([hall?.partnerName, venue?.partnerName], [name, name]);
        assert.ok(!JSON.stringify([hall, venue]).includes(LEGAL), 'raison sociale rendue');
    });
});

describe('B — nom commercial obligatoire (inscription et profil)', () => {
    const valid = {
        companyName: 'Traiteur Royal Dakar SARL', commercialName: 'Royal Buffet', description: 'Service traiteur pour les tests du lot.',
        address: 'Almadies Zone 4', city: 'Dakar', activities: ['TRAITEUR'], firstName: 'Aminata', lastName: 'Diallo', phone: '77 456 78 90',
        email: 'aminata@exemple.sn', password: 'MotDePasse!2026', confirmPassword: 'MotDePasse!2026',
        idCardUploadToken: 'jeton-fictif-piece-identite', businessDocUploadToken: 'jeton-fictif-document-entreprise',
    };

    test('inscription : sans nom commercial, ou vide, refusée avec le message du champ ; avec, acceptée', () => {
        assert.equal(RegisterPartnerFieldsSchema.safeParse(valid).success, true, JSON.stringify(RegisterPartnerFieldsSchema.safeParse(valid).error?.issues));
        const { commercialName: _omitted, ...without } = valid;
        for (const candidate of [without, { ...valid, commercialName: '' }, { ...valid, commercialName: '   ' }]) {
            const r = RegisterPartnerFieldsSchema.safeParse(candidate);
            assert.equal(r.success, false, `accepté sans nom commercial : ${JSON.stringify((candidate as { commercialName?: string }).commercialName ?? null)}`);
            const issue = r.error!.issues.find((i) => i.path[0] === 'commercialName');
            assert.ok(issue, `aucune erreur sur commercialName : ${JSON.stringify(r.error!.issues)}`);
        }
    });

    test('profil : nom commercial vidé refusé (400, champ commercial_name), rien d’écrit ; un nom valable est enregistré', async () => {
        const kept = `Enseigne gardée ${TOKEN}`;
        await setNames(kept);
        for (const value of ['', '   ', null]) {
            const r = await api('PATCH', 'partner/profile', { token: owner.accessToken, body: { commercial_name: value } });
            assert.equal(r.status, 400, `nom commercial ${JSON.stringify(value)} : ${show(r)}`);
            assert.equal(r.body.field, 'commercial_name', show(r));
        }
        const { data } = await service.from('partners').select('commercial_name').eq('id', owner.partnerId).single();
        assert.equal(data?.commercial_name, kept, 'nom commercial écrit malgré le refus');
        const next = `Nouvelle enseigne ${TOKEN}`;
        const ok = await api('PATCH', 'partner/profile', { token: owner.accessToken, body: { commercial_name: next } });
        assert.ok(ok.status < 300, show(ok));
        const { data: after0 } = await service.from('partners').select('commercial_name').eq('id', owner.partnerId).single();
        assert.equal(after0?.commercial_name, next);
    });
});
