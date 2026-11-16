/**
 * Correctifs de la contre-vérification de la finition 2a, T2 — valider l'écart d'une caisse : refusé à une fiche SUSPENDU,
 * à la route et en base ; l'écart reste à valider par un admin muni de events.write.
 *
 * Montage : une caisse ouverte puis fermée avec 500 FCFA de trop par le contrôleur, avant la suspension de la fiche.
 *  a. route POST /api/partner/shifts/[id]/validate-discrepancy, mot de passe saisi : 403 PARTNER_SUSPENDED, texte de la
 *     fiche suspendue suivi du contact du support ; l'écart reste « à valider » ;
 *  b. base : shift_discrepancy_validate avec la partenaire suspendue pour autrice : PARTNER_SUSPENDED, rien ne change ;
 *  c. admin sans events.write : « Caisse introuvable » ; admin muni de events.write, par la route (mot de passe saisi) :
 *     écart validé, par lui, journalisé ADMIN.
 * Rouge avant le correctif : la route et la fonction acceptaient la partenaire suspendue ; un admin ne pouvait pas valider
 * (404). Sortie brute `[F2ACV-T2]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { service } from './paiement-helpers';
import { openShift } from './acces-helpers';
import { newAdmin } from './notif-helpers';
import { confirmPassword, STRONG_PASSWORD } from './helpers';
import { stepUpTestSession } from '../helpers/admin-step-up';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { PARTNER_SUSPENDED_TEXT } from '../../lib/auth/partner-fiche-guard';
import { api, setFiche, show, type Row } from '../audit/cvf1-helpers';
import { mount, type Mount } from '../audit/cvf2a-helpers';

let M: Mount;
let shiftId: string;

before(async () => {
    M = await mount('cv-t2-caisse', { canAcceptCash: true });
    const opened = await openShift(M.ctrl, M.ev.eventId, 0);
    assert.equal(opened.status, 200, `ouverture de caisse (montage) : ${JSON.stringify(opened.body).slice(0, 300)}`);
    shiftId = String((opened.body.shift as { id?: string } | undefined)?.id ?? opened.body.shift_id ?? opened.body.id);
    const closed = await api('POST', 'controller/shifts/close', {
        token: M.ctrl.accessToken, body: { shiftId, declaredCashTotal: 500, justification: 'Monnaie rendue en trop (montage f2acv)' },
    });
    assert.equal(closed.status, 200, `clôture avec écart (montage) : ${show(closed)}`);
    assert.equal(closed.body.discrepancy_pending, true, `écart en attente (montage) : ${show(closed)}`);
    await setFiche(M.P.partnerId, 'SUSPENDU');
});

after(async () => {
    await setFiche(M.P.partnerId, 'VALIDE');
    await assertFinition1Invariants('f2acv-ecart-caisse');
});

async function validation(): Promise<Row> {
    const { data, error } = await service.from('controller_shifts').select('discrepancy_validated_at, discrepancy_validated_by').eq('id', shiftId).single();
    assert.equal(error, null, error?.message);
    return data as Row;
}

describe('T2. écart d’une caisse, fiche SUSPENDU', () => {
    test('a. route : 403 PARTNER_SUSPENDED, texte et contact du support ; écart toujours à valider', async () => {
        await confirmPassword(M.P, STRONG_PASSWORD);
        const r = await api('POST', 'partner/shifts/[id]/validate-discrepancy', {
            token: M.P.accessToken, path: `/api/partner/shifts/${shiftId}/validate-discrepancy`, params: { id: shiftId }, body: {},
        });
        console.log(`[F2ACV-T2] POST /api/partner/shifts/[id]/validate-discrepancy (fiche SUSPENDU) → ${show(r)}`);
        assert.equal(r.status, 403, show(r));
        assert.equal(r.body.code, 'PARTNER_SUSPENDED', show(r));
        assert.ok(String(r.body.error).startsWith(`${PARTNER_SUSPENDED_TEXT} `), `texte et contact : ${show(r)}`);
        assert.equal((await validation()).discrepancy_validated_at ?? null, null, 'écart validé par une fiche SUSPENDU');
    });

    test('b. base : shift_discrepancy_validate, la partenaire suspendue pour autrice : PARTNER_SUSPENDED, rien ne change', async () => {
        const { data, error } = await service.rpc('shift_discrepancy_validate', { p: { shift_id: shiftId, actor_id: M.P.userId } });
        console.log(`[F2ACV-T2] shift_discrepancy_validate (fiche SUSPENDU) → ${error ? `erreur ${error.message}` : JSON.stringify(data)}`);
        assert.equal(error, null, error?.message);
        assert.equal((data as Row).code, 'PARTNER_SUSPENDED', JSON.stringify(data));
        assert.equal((data as Row).message, PARTNER_SUSPENDED_TEXT);
        assert.equal((await validation()).discrepancy_validated_at ?? null, null, 'écart validé en base par une fiche SUSPENDU');
    });

    test('c. admin : sans events.write refusé ; avec events.write, par la route : écart validé, journalisé ADMIN', async () => {
        const reader = await newAdmin('cv-t2-lecteur', ['events.read']);
        const { data: refused } = await service.rpc('shift_discrepancy_validate', { p: { shift_id: shiftId, actor_id: reader.userId } });
        console.log(`[F2ACV-T2] admin sans events.write → ${JSON.stringify(refused)}`);
        assert.equal((refused as Row).code, 'SHIFT_NOT_FOUND', JSON.stringify(refused));
        const writer = await newAdmin('cv-t2-ecrivain', ['events.write']);
        await stepUpTestSession(writer.accessToken);
        await confirmPassword(writer, STRONG_PASSWORD);
        const r = await api('POST', 'partner/shifts/[id]/validate-discrepancy', {
            token: writer.accessToken, path: `/api/partner/shifts/${shiftId}/validate-discrepancy`, params: { id: shiftId }, body: {},
        });
        console.log(`[F2ACV-T2] POST validate-discrepancy (admin events.write, fiche SUSPENDU) → ${show(r)}`);
        assert.equal(r.status, 200, show(r));
        const v = await validation();
        assert.ok(v.discrepancy_validated_at, 'écart non validé par l’admin');
        assert.equal(v.discrepancy_validated_by, writer.userId);
        const { data: logs } = await service.from('audit_logs').select('user_role').eq('object_id', shiftId).eq('action', 'SHIFT_DISCREPANCY_VALIDATED');
        assert.deepEqual((logs ?? []).map((l) => l.user_role), ['ADMIN'], `journal : ${JSON.stringify(logs)}`);
    });
});
