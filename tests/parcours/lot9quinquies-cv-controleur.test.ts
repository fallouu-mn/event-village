/**
 * Lot 9 quinquies, correctifs de la contre-vérification — point 4 : une fiche partenaire ni VALIDE ni SUSPENDU rend
 * inactives les affectations de contrôleurs de ses événements : scan refusé, même pour la partenaire affectée à son
 * propre événement.
 *
 * Rouge avant correctif (contre-vérification, run 177, cv9qq-4 d, observation) : la partenaire EN_ATTENTE affectée comme
 * contrôleuse de son propre événement obtenait 200 au scan (scan_scanner_authorized ne regardait pas la fiche).
 *
 * Fiche VALIDE (témoin) : le contrôleur et la partenaire affectée passent la garde du scan. Fiche EN_ATTENTE puis REJETE :
 * 403 SCAN_FORBIDDEN pour les deux. Fiche SUSPENDU : affectations actives (même règle que la garde A9).
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { service, type Buyer } from './paiement-helpers';
import { createPartnerEvent, newPartner, type TestPartner } from './finance-helpers';
import { assignController, newController, scan } from './acces-helpers';

let partner: TestPartner;
let controller: Buyer;
let eventId: string;

before(async () => {
    partner = await newPartner('cv-ctrl');
    eventId = (await createPartnerEvent(partner.partnerId, 'cv-ctrl', [{ name: 'Standard', price: 5_000, total: 20 }])).eventId;
    controller = await newController(partner, eventId, { label: 'cv-ctrl' });
    const { error } = await service.from('user_roles').upsert([{ user_id: partner.userId, role: 'CONTROLEUR' }], { onConflict: 'user_id,role' });
    assert.equal(error, null, error?.message);
    await assignController(partner, partner.userId, eventId, false);
});

after(async () => {
    await setFiche('VALIDE');
    await assertLot9quinquiesInvariants('lot9quinquies-cv-controleur');
});

async function setFiche(status: 'VALIDE' | 'EN_ATTENTE' | 'REJETE' | 'SUSPENDU'): Promise<void> {
    const { error } = await service.from('partners').update({ status, ...(status === 'REJETE' ? { rejection_reason: 'Pièces illisibles (contre-vérification)' } : {}) }).eq('id', partner.partnerId);
    assert.equal(error, null, `fiche ${status} : ${error?.message}`);
}

async function scanOutcome(user: Buyer): Promise<string> {
    const r = await scan(user, { eventId, manualTicketNumber: 'EV-0000-0000' });
    return `${r.status}/${String(r.body.code ?? r.body.result ?? '')}`;
}

describe('Point 4 — fiche ni VALIDE ni SUSPENDU : affectations de contrôleurs inactives', () => {
    test('fiche VALIDE (témoin), EN_ATTENTE, REJETE, SUSPENDU : scan du contrôleur et de la partenaire affectée', async () => {
        const seen: Record<string, { controleur: string; partenaire: string }> = {};
        for (const status of ['VALIDE', 'EN_ATTENTE', 'REJETE', 'SUSPENDU'] as const) {
            await setFiche(status);
            seen[status] = { controleur: await scanOutcome(controller), partenaire: await scanOutcome(partner) };
        }
        console.log(`[CV-4] scans selon la fiche : ${JSON.stringify(seen)}`);
        for (const status of ['VALIDE', 'SUSPENDU']) {
            assert.ok(!seen[status].controleur.startsWith('403'), `fiche ${status} : le contrôleur affecté passe la garde (${seen[status].controleur})`);
        }
        assert.ok(!seen.VALIDE.partenaire.startsWith('403'), `fiche VALIDE : la partenaire affectée passe la garde (${seen.VALIDE.partenaire})`);
        for (const status of ['EN_ATTENTE', 'REJETE']) {
            assert.equal(seen[status].controleur, '403/SCAN_FORBIDDEN', `fiche ${status} : contrôleur`);
            assert.equal(seen[status].partenaire, '403/SCAN_FORBIDDEN', `fiche ${status} : la partenaire elle-même`);
        }
    });
});
