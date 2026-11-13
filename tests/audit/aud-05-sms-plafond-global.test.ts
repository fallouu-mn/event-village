/**
 * Audit de sécurité du module événements — AUD-05 : le plafond journalier GLOBAL des SMS est un compteur unique que
 * n'importe quel visiteur consomme ; une fois atteint, plus aucun code SMS ne part pour personne jusqu'au lendemain.
 *
 * lib/sms/sms-guard.ts:85-97 : un SMS OTP réserve `sms_global/all` (plafond SMS_GLOBAL_DAILY_CAP, 1 000 par défaut,
 * lib/env.ts:62) en plus des limites par numéro et par IP. POST /api/auth/register/start est anonyme et accepte tout
 * numéro neuf (app/api/auth/register/start/route.ts) ; la limite par IP (30 par jour par défaut, lib/env.ts:60) se lit dans
 * la première valeur de x-forwarded-for (lib/security/client-ip.ts, CLIENT_IP_SOURCE par défaut lib/env.ts:121), que le
 * client écrit lui-même hors d'un proxy qui la réécrit. Les SMS non OTP partagent le même compteur (sms-guard.ts:105).
 *
 * Test ROUGE tant que la faille existe : plafond global réglé à « consommé + 3 » (pour ne pas envoyer 1 000 SMS),
 * trois démarrages d'inscription anonymes vers trois numéros quelconques, depuis trois adresses inventées, puis un
 * vrai client demande son code : il doit le recevoir.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomSenegalPhone } from '../parcours/helpers';
import { service } from '../parcours/paiement-helpers';
import { withEnv } from '../parcours/notif-helpers';
import { registerStart } from '../parcours/terrain-helpers';
import { getFakes } from '../fakes';

const DAY = 86_400;

async function globalHits(): Promise<number> {
    const { data, error } = await service.from('quota_counters').select('hits, window_start')
        .eq('scope', 'sms_global').eq('bucket', 'all').eq('window_secs', DAY)
        .order('window_start', { ascending: false }).limit(1);
    assert.equal(error, null, `lecture de quota_counters : ${error?.message}`);
    const row = (data ?? [])[0];
    return row && new Date(String(row.window_start)).getTime() + DAY * 1000 > Date.now() ? Number(row.hits) : 0;
}

describe('AUD-05 — plafond global des SMS consommé par des visiteurs anonymes', () => {
    test('trois demandes anonymes vers des numéros quelconques n\'empêchent pas un client de recevoir son code', async () => {
        const before = await globalHits();
        const cap = before + 3;
        const outcome = await withEnv({ SMS_GLOBAL_DAILY_CAP: String(cap) }, async () => {
            const attacks: number[] = [];
            for (let i = 0; i < 3; i += 1) {
                const r = await registerStart(randomSenegalPhone('76'), { 'x-forwarded-for': `192.0.2.${10 + i}` });
                attacks.push(r.status);
            }
            const victimPhone = randomSenegalPhone('78');
            const since = getFakes().sms.messagesTo(victimPhone).length;
            const victim = await registerStart(victimPhone, { 'x-forwarded-for': '198.18.0.42' });
            return { attacks, victim, received: getFakes().sms.messagesTo(victimPhone).length - since };
        });
        console.log(`[AUD-05] plafond global réglé à ${cap} (consommé avant : ${before}) ; démarrages anonymes : ${outcome.attacks.join(', ')} ; client : HTTP ${outcome.victim.status} ${JSON.stringify(outcome.victim.body).slice(0, 200)} ; SMS reçus par le client : ${outcome.received}`);
        assert.deepEqual(outcome.attacks, [200, 200, 200], 'précondition : les trois démarrages anonymes envoient leur SMS');
        assert.equal(outcome.victim.status, 200,
            `après ${outcome.attacks.length} demandes anonymes (trois adresses x-forwarded-for inventées), le code d'inscription d'un client est refusé : HTTP ${outcome.victim.status} ${JSON.stringify(outcome.victim.body)}`);
        assert.equal(outcome.received, 1, 'le client reçoit son code par SMS');
    });
});
