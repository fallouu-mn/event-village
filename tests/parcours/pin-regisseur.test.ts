/**
 * Lot 1A.5 — le PIN régisseur fonctionne toujours après son déplacement hors de la table
 * events (exposée à anon) : génération par le partenaire propriétaire, vérification du bon
 * PIN, refus d'un PIN erroné.
 */
import '../helpers/env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFixtures } from '../helpers/fixtures';
import { ShiftService } from '../../lib/shifts/shift.service';

test('PIN régisseur : génération, vérification du bon PIN, refus d\'un PIN erroné', async () => {
    const fx = await loadFixtures();
    const eventId = fx.events.A_PUBLIE.id;

    // Lot 4.7 : la (re)génération du PIN doit être confirmée explicitement ; aucune caisse n'est ouverte ici.
    const { pin } = await ShiftService.generateRegisseurPin(eventId, fx.users.PARTNER_A.id, { confirm: true });
    assert.match(pin, /^\d{6}$/, 'PIN à 6 chiffres');

    const ok = await ShiftService.verifyRegisseurPin(eventId, pin, fx.users.CONTROLLER_A.id);
    assert.equal(ok.valid, true, `bon PIN refusé : ${ok.message}`);

    const wrong = pin === '000000' ? '111111' : '000000';
    const ko = await ShiftService.verifyRegisseurPin(eventId, wrong, fx.users.CONTROLLER_A.id);
    assert.equal(ko.valid, false, 'un PIN erroné doit être refusé');
});

test('PIN régisseur : un partenaire non propriétaire ne peut pas générer le PIN', async () => {
    const fx = await loadFixtures();
    await assert.rejects(
        () => ShiftService.generateRegisseurPin(fx.events.A_PUBLIE.id, fx.users.PARTNER_B.id),
        /Non autorisé/
    );
});
