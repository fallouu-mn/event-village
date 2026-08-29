import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { formatMTargetPhoneNumber, MTargetService } from '../lib/sms/mtarget.service';
import { POST } from '../app/api/auth/sms-hook/route';
import { NextRequest } from 'next/server';

test('1. Formatage MTarget : numéro local sénégalais "77 123 45 67"', () => {
    const formatted = formatMTargetPhoneNumber('77 123 45 67');
    assert.equal(formatted, '00221771234567');
});

test('2. Formatage MTarget : numéro international "+221771234567"', () => {
    const formatted = formatMTargetPhoneNumber('+221771234567');
    assert.equal(formatted, '00221771234567');
});

test('3. Formatage MTarget : numéro avec espaces "+221 78 987 65 43"', () => {
    const formatted = formatMTargetPhoneNumber('+221 78 987 65 43');
    assert.equal(formatted, '00221789876543');
});

test('4. Formatage MTarget : numéro brut avec indicatif "221761112233"', () => {
    const formatted = formatMTargetPhoneNumber('221761112233');
    assert.equal(formatted, '00221761112233');
});

test('5. Formatage MTarget : déjà au format 00221 "00221701234567"', () => {
    const formatted = formatMTargetPhoneNumber('00221701234567');
    assert.equal(formatted, '00221701234567');
});

test('6. Formatage MTarget : numéro avec tirets et parenthèses "(+221) 75-555-44-33"', () => {
    const formatted = formatMTargetPhoneNumber('(+221) 75-555-44-33');
    assert.equal(formatted, '00221755554433');
});

test('7. Initialisation MTargetService avec configuration personnalisée', () => {
    const service = new MTargetService({
        username: 'custom_user',
        password: 'custom_password',
        serviceId: '36233',
        sender: 'EasyArena',
    });
    assert.ok(service);
});

test('8. Route API Hook Supabase : Rejet si payload vide ou incomplet', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/sms-hook', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error, 'Numéro de téléphone ou code OTP manquant.');
});

test('9. Route API Hook Supabase : Extraction valide du format standard Supabase', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/sms-hook', {
        method: 'POST',
        body: JSON.stringify({
            user: {
                id: 'usr-test-001',
                phone: '+221771234567',
            },
            sms: {
                otp: '849201',
            },
        }),
        headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    assert.ok([200, 502].includes(res.status));
});

test('10. Route API Hook Supabase : Signature Svix HMAC-SHA256 valide (v1,whsec_...)', async () => {
    const secret = 'v1,whsec_eqdLkTwdTSs+uH/YT5xpiT93nofGIebmpuM/xA/2VWkiPqxcWGH+DhNkp4n0Yju9DhJkP5FQW4RhybDR';
    process.env.SUPABASE_AUTH_HOOK_SECRET = secret;

    const payload = JSON.stringify({
        user: { phone: '+221771234567' },
        sms: { otp: '654321' },
    });

    const msgId = 'msg_test_12345';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const secretKey = secret.replace(/^v1,/, '').replace(/^whsec_/, '');
    const signature = crypto
        .createHmac('sha256', Buffer.from(secretKey, 'base64'))
        .update(`${msgId}.${timestamp}.${payload}`)
        .digest('base64');

    const req = new NextRequest('http://localhost:3000/api/auth/sms-hook', {
        method: 'POST',
        body: payload,
        headers: {
            'Content-Type': 'application/json',
            'webhook-id': msgId,
            'webhook-timestamp': timestamp,
            'webhook-signature': `v1,${signature}`,
        },
    });

    const res = await POST(req);
    assert.notEqual(res.status, 401);
});
