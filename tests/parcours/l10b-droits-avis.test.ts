/**
 * Contre-vérification du lot 10b (demande du 19/11) — droits d'un administrateur donnés ou retirés par un Superadmin
 * (POST /api/admin/permissions → admin_permissions_set) : l'administrateur est prévenu sur les 4 canaux (« Vous pouvez
 * maintenant valider les salles et les établissements. » / « Vous ne pouvez plus … »), les autres Superadmins actifs
 * reçoivent une alerte (4 canaux), l'auteur n'en reçoit pas ; rien si les droits ne changent pas ; SMS d'un segment.
 * Base LOCALE ; route réelle (session du Superadmin).
 */
import '../helpers/env';
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { newAdmin, type TestAdmin } from './notif-helpers';
import { api, show } from '../audit/cvf1-helpers';
import { service } from './paiement-helpers';
import { renderNotification } from '../../lib/notifications/catalog';
import { smsSegments } from '../../lib/notifications/sms-format';
import { PERMISSION_PROFILES } from '../../lib/admin/permission-profiles';
import { confirmIdentity } from './f3d-helpers';

type Row = Record<string, unknown>;
const CTX = { appUrl: 'https://eventvillage.sn' };

let actor: TestAdmin;
let otherSuper: TestAdmin;
let target: TestAdmin;

before(async () => {
    actor = await newAdmin('l10b-droits-auteur', [], { role: 'SUPERADMIN' });
    otherSuper = await newAdmin('l10b-droits-autre-super', [], { role: 'SUPERADMIN' });
    target = await newAdmin('l10b-droits-cible', ['events.read']);
    // La route exige l'identité confirmée du Superadmin (mot de passe et code par SMS)
    await confirmIdentity(actor);
});

async function rowsOf(userId: string, type: string): Promise<Row[]> {
    const { data, error } = await service.from('notification_outbox').select('channel, template_data, idempotency_key, created_at')
        .eq('recipient_user_id', userId).eq('type', type).order('created_at');
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

const setRights = (permissions: string[]) => api('POST', 'admin/permissions', { token: actor.accessToken, body: { adminId: target.userId, permissions } });

/** Dernier avis (les 4 lignes d'un même changement partagent le début de leur clé). */
function lastNotice(rows: Row[]): Row[] {
    if (rows.length === 0) return [];
    const key = String(rows[rows.length - 1].idempotency_key).replace(/:(IN_APP|PUSH|EMAIL|SMS)$/, '');
    return rows.filter((r) => String(r.idempotency_key).startsWith(key));
}

const channelsOf = (rows: Row[]): string[] => [...new Set(rows.map((r) => String(r.channel)))].sort();

describe('Droits d’un administrateur : avis à l’administrateur, alerte aux autres Superadmins', () => {
    test('droit donné : « Vous pouvez maintenant valider les salles et les établissements. » sur les 4 canaux ; alerte aux autres Superadmins, pas à l’auteur', async () => {
        const r = await setRights(['events.read', 'halls.validate']);
        assert.equal(r.status, 200, show(r));
        const notice = lastNotice(await rowsOf(target.userId, 'ADMIN_PERMISSIONS_CHANGED'));
        assert.deepEqual(channelsOf(notice), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], JSON.stringify(notice));
        const data = notice[0].template_data as Row;
        assert.deepEqual([data.added, data.removed], [['halls.validate'], []]);
        const inApp = renderNotification('ADMIN_PERMISSIONS_CHANGED', 'IN_APP', data, CTX) as { content: string };
        assert.equal(inApp.content, 'Vous pouvez maintenant valider les salles et les établissements.');
        const sms = renderNotification('ADMIN_PERMISSIONS_CHANGED', 'SMS', data, CTX) as { text: string };
        assert.equal(sms.text, 'Event Village : vous pouvez maintenant valider les salles et les établissements.');
        assert.deepEqual([smsSegments(sms.text).encoding, smsSegments(sms.text).segments], ['GSM7', 1]);

        const alert = lastNotice(await rowsOf(otherSuper.userId, 'ADMIN_PERMISSIONS_ALERT'));
        assert.deepEqual(channelsOf(alert), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], JSON.stringify(alert));
        assert.equal((alert[0].template_data as Row).admin_id, target.userId);
        assert.equal((await rowsOf(actor.userId, 'ADMIN_PERMISSIONS_ALERT')).length, 0, 'l’auteur reçoit sa propre alerte');
    });

    test('droit retiré : « Vous ne pouvez plus valider les salles et les établissements. »', async () => {
        const r = await setRights(['events.read']);
        assert.equal(r.status, 200, show(r));
        const data = lastNotice(await rowsOf(target.userId, 'ADMIN_PERMISSIONS_CHANGED'))[0].template_data as Row;
        assert.deepEqual([data.added, data.removed], [[], ['halls.validate']]);
        const sms = renderNotification('ADMIN_PERMISSIONS_CHANGED', 'SMS', data, CTX) as { text: string };
        assert.equal(sms.text, 'Event Village : vous ne pouvez plus valider les salles et les établissements.');
    });

    test('profil « Validation » donné : chaque droit ajouté nommé ; SMS d’un segment avec le lien du détail', async () => {
        const profile = PERMISSION_PROFILES.find((p) => p.key === 'validation')!;
        const r = await setRights([...profile.permissions]);
        assert.equal(r.status, 200, show(r));
        const data = lastNotice(await rowsOf(target.userId, 'ADMIN_PERMISSIONS_CHANGED'))[0].template_data as Row;
        assert.deepEqual([...(data.added as string[])].sort(), profile.permissions.filter((p) => p !== 'events.read').sort());
        const inApp = renderNotification('ADMIN_PERMISSIONS_CHANGED', 'IN_APP', data, CTX) as { content: string };
        assert.ok(inApp.content.includes('Vous pouvez maintenant valider les salles et les établissements.'), inApp.content);
        const sms = renderNotification('ADMIN_PERMISSIONS_CHANGED', 'SMS', data, CTX) as { text: string };
        assert.deepEqual([smsSegments(sms.text).encoding, smsSegments(sms.text).segments], ['GSM7', 1], sms.text);
        assert.match(sms.text, /ajouté\(s\), 0 retiré\(s\)\. Détail : https:\/\/eventvillage\.sn\/admin\/mes-droits$/);
    });

    test('mêmes droits renvoyés : aucun avis, aucune alerte', async () => {
        const before = (await rowsOf(target.userId, 'ADMIN_PERMISSIONS_CHANGED')).length;
        const beforeAlert = (await rowsOf(otherSuper.userId, 'ADMIN_PERMISSIONS_ALERT')).length;
        const profile = PERMISSION_PROFILES.find((p) => p.key === 'validation')!;
        const r = await setRights([...profile.permissions]);
        assert.equal(r.status, 200, show(r));
        assert.equal((await rowsOf(target.userId, 'ADMIN_PERMISSIONS_CHANGED')).length, before);
        assert.equal((await rowsOf(otherSuper.userId, 'ADMIN_PERMISSIONS_ALERT')).length, beforeAlert);
    });
});
