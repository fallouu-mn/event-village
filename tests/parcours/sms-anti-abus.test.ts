/**
 * Lot 1C.9 — anti-abus SMS (chaque SMS est facturé au client).
 * Compteurs en base, réservation atomique, refus en fail-closed si la garde ne répond pas.
 * Ce processus règle de petites limites (variables d'environnement, propres à la suite) :
 *  - rafale de demandes d'OTP sur un même numéro → bloquée après la limite (même en parallèle) ;
 *  - même IP, numéros différents → bloquée après la limite par IP ;
 *  - plafond global quotidien atteint → refus propre, alerte journalisée et notification in-app
 *    aux superadmins, aucun SMS ;
 *  - garde indisponible (EXECUTE retiré au service_role) → 503, aucun SMS ;
 *  - inscription d'un numéro déjà inscrit → 409 sans SMS ;
 *  - hook SMS de Supabase Auth : un fragment du secret ne suffit plus.
 */
import '../helpers/env';
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { resetServerEnvCache } from '../../lib/env';
import { loadFixtures } from '../helpers/fixtures';
import { POST as sendOtp } from '../../app/api/auth/send-otp/route';
import { POST as registerClient } from '../../app/api/auth/register/route';
import { POST as smsHook } from '../../app/api/auth/sms-hook/route';
import { getFakes } from '../fakes';
import { jsonRequest, randomEmail, randomSenegalPhone, STRONG_PASSWORD } from './helpers';

const LIMITS = {
    SMS_OTP_PER_PHONE_15MIN: '2',
    SMS_OTP_PER_PHONE_DAY: '20',
    SMS_OTP_PER_IP_HOUR: '3',
    SMS_OTP_PER_IP_DAY: '50',
};

let ipSeq = 0;
function freshIp(): string {
    ipSeq += 1;
    return `198.51.100.${(ipSeq % 250) + 1}`;
}

function otpRequest(phone: string, ip: string) {
    return jsonRequest('/api/auth/send-otp', { phone }, { 'x-forwarded-for': `${ip}, 10.0.0.1` });
}

async function globalCountToday(): Promise<number> {
    const day = new Date().toISOString().slice(0, 10);
    const { data, error } = await getServiceRoleClient()
        .from('quota_counters')
        .select('hits, window_start')
        .eq('scope', 'sms_global')
        .eq('bucket', 'all')
        .gte('window_start', `${day}T00:00:00Z`);
    assert.equal(error, null, `lecture du compteur global : ${error?.message}`);
    return (data || []).reduce((s, r) => s + Number(r.hits), 0);
}

before(() => {
    Object.assign(process.env, LIMITS);
    resetServerEnvCache();
});

describe('Anti-abus SMS', () => {
    test('rafale parallèle sur un même numéro : seuls les envois sous la limite partent', async () => {
        const phone = randomSenegalPhone('76');
        const results = await Promise.all(Array.from({ length: 6 }, () => sendOtp(otpRequest(phone, freshIp()))));
        const statuses = results.map((r) => r.status).sort();
        const ok = statuses.filter((s) => s === 200).length;
        assert.equal(ok, 2, `envois acceptés : ${ok} (statuts ${statuses.join(',')})`);
        assert.ok(statuses.filter((s) => s === 429).length === 4, `refus 429 attendus : ${statuses.join(',')}`);
        assert.equal(getFakes().sms.messagesTo(phone).length, 2, 'exactement 2 SMS envoyés à ce numéro');
        const refused = await Promise.all(results.filter((r) => r.status === 429).map((r) => r.json()));
        assert.ok(refused.every((b) => b.code === 'SMS_RATE_LIMITED'), `code de refus : ${JSON.stringify(refused[0])}`);
    });

    test('même IP, numéros différents : bloquée après la limite par IP', async () => {
        const ip = freshIp();
        const statuses: number[] = [];
        for (let i = 0; i < 5; i += 1) statuses.push((await sendOtp(otpRequest(randomSenegalPhone('77'), ip))).status);
        assert.deepEqual(statuses, [200, 200, 200, 429, 429], `statuts par envoi depuis ${ip}`);
    });

    test('plafond global quotidien atteint : refus propre, alerte journalisée, aucun SMS', async () => {
        const fx = await loadFixtures();
        const used = await globalCountToday();
        process.env.SMS_GLOBAL_DAILY_CAP = String(used + 1);
        resetServerEnvCache();
        try {
            const first = randomSenegalPhone('78');
            assert.equal((await sendOtp(otpRequest(first, freshIp()))).status, 200, 'dernier SMS sous le plafond');
            const second = randomSenegalPhone('78');
            const res = await sendOtp(otpRequest(second, freshIp()));
            const body = await res.json();
            assert.equal(res.status, 429, `plafond : HTTP ${res.status} ${JSON.stringify(body)}`);
            assert.equal(body.code, 'SMS_DAILY_CAP_REACHED');
            assert.equal(getFakes().sms.messagesTo(second).length, 0, 'aucun SMS au-delà du plafond');

            const service = getServiceRoleClient();
            const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            const { data: audit } = await service.from('audit_logs').select('id').eq('action', 'SMS_GLOBAL_DAILY_CAP_REACHED').gte('created_at', since);
            assert.ok((audit || []).length >= 1, 'alerte « plafond SMS atteint » journalisée dans audit_logs');
            const { data: notif } = await service.from('notifications').select('id, channel').eq('user_id', fx.users.SUPERADMIN.id).eq('type', 'SMS_DAILY_CAP_REACHED').gte('created_at', since);
            assert.ok((notif || []).length >= 1, 'notification in-app aux superadmins');
            assert.ok((notif || []).every((n) => n.channel !== 'SMS'), 'l’alerte ne part jamais par SMS');
        } finally {
            delete process.env.SMS_GLOBAL_DAILY_CAP;
            resetServerEnvCache();
        }
    });

    test('garde indisponible : refus 503 en fail-closed, aucun SMS', async () => {
        const db = new Client({ connectionString: process.env.SUPABASE_DB_URL });
        await db.connect();
        const phone = randomSenegalPhone('76');
        try {
            await db.query('REVOKE EXECUTE ON FUNCTION public.quota_reserve(jsonb) FROM service_role');
            const res = await sendOtp(otpRequest(phone, freshIp()));
            const body = await res.json();
            assert.equal(res.status, 503, `HTTP ${res.status} ${JSON.stringify(body)}`);
            assert.equal(body.code, 'SMS_GUARD_UNAVAILABLE');
            assert.equal(getFakes().sms.messagesTo(phone).length, 0, 'aucun SMS sans garde');
        } finally {
            await db.query('GRANT EXECUTE ON FUNCTION public.quota_reserve(jsonb) TO service_role').catch((e: Error) => {
                throw new Error(`restauration du droit EXECUTE impossible : ${e.message}`);
            });
            await db.end();
        }
    });

    test('inscription d’un numéro déjà inscrit : 409, aucun SMS', async () => {
        const fx = await loadFixtures();
        const phone = fx.users.CLIENT_BIS.phone;
        const before = getFakes().sms.messagesTo(phone).length;
        const res = await registerClient(jsonRequest('/api/auth/register', {
            firstName: 'Double', lastName: 'Inscription', phone, email: randomEmail('double'),
            password: STRONG_PASSWORD, confirmPassword: STRONG_PASSWORD,
        }, { 'x-forwarded-for': freshIp() }));
        assert.equal(res.status, 409, `HTTP ${res.status} ${JSON.stringify(await res.json())}`);
        assert.equal(getFakes().sms.messagesTo(phone).length, before, 'aucun SMS envoyé à un numéro déjà inscrit');
    });

    test('hook SMS de Supabase Auth : un fragment du secret est refusé, aucun SMS', async () => {
        const phone = randomSenegalPhone('77');
        const secret = String(process.env.SUPABASE_AUTH_HOOK_SECRET);
        const res = await smsHook(jsonRequest('/api/auth/sms-hook', { user: { phone }, sms: { otp: '123456' } }, { authorization: `Bearer ${secret.slice(0, 2)}` }));
        assert.equal(res.status, 401, `fragment du secret : HTTP ${res.status}`);
        assert.equal(getFakes().sms.messagesTo(phone).length, 0, 'aucun SMS relayé');
    });

    test('point d’envoi unique : aucun accès direct à l’adaptateur SMS hors lib/sms et lib/integrations', () => {
        const offenders: string[] = [];
        const walk = (p: string) => {
            for (const e of fs.readdirSync(p, { withFileTypes: true })) {
                const full = path.join(p, e.name);
                if (e.isDirectory()) walk(full);
                else if (/\.(ts|tsx)$/.test(e.name)) {
                    const rel = full.replace(/\\/g, '/');
                    if (rel.startsWith('lib/sms/') || rel.startsWith('lib/integrations/')) continue;
                    const src = fs.readFileSync(full, 'utf8');
                    if (/getSmsAdapter|MTargetHttpAdapter|mtarget\.fr/.test(src)) offenders.push(rel);
                }
            }
        };
        for (const d of ['app', 'lib', 'components', 'hooks']) if (fs.existsSync(d)) walk(d);
        assert.deepEqual(offenders, [], `accès direct à l’adaptateur SMS :\n${offenders.join('\n')}`);
    });
});
