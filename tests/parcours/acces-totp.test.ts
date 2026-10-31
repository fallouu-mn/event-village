/**
 * Lot 4.2 (contrats B et C) — code dynamique du billet : secret dédié, secret par billet réellement
 * utilisé, tolérance ±1 pas de 20 s, comparaison en temps constant, live-code réservé au porteur.
 *  - lib/env.ts : TICKET_TOTP_MASTER_KEY et REGISSEUR_PIN_KEY obligatoires (≥ 32 caractères), sans repli,
 *    distinctes des autres secrets ; déclarées dans .env.example, .env.test.example et la documentation ;
 *  - lib/security/totp.ts et lib/shifts/shift.service.ts : plus aucune dérivation depuis
 *    SUPABASE_AUTH_HOOK_SECRET ni la clé service_role ; timingSafeEqual ;
 *  - billet émis par le checkout : totp_secret de 64 hexadécimaux ; colonne NOT NULL avec défaut ;
 *  - verifyTicketCode : ±1 pas (−15 s et +15 s acceptés, −45 s et +45 s refusés) ;
 *  - scan : code courant accepté, code de plus de 40 s refusé (qr_expired) ; un TOTP « naïf » calculé
 *    sur la seule colonne totp_secret est refusé (la clé effective dépend de TICKET_TOTP_MASTER_KEY) ;
 *  - transfert : le code de l'ancien secret est refusé, l'ancien porteur n'obtient plus de live-code ;
 *  - live-code : porteur seulement (404 pour tout autre compte, personnel compris), payload
 *    EVT1:<UUID>:<6 chiffres>, step_seconds = 20, payload accepté au scan.
 * Rouge avant correctif : lib/env.ts:24-89 ne déclare aucune des deux clés ; lib/security/totp.ts:17-22
 * dérive le secret de SUPABASE_AUTH_HOOK_SECRET || SUPABASE_SERVICE_ROLE_KEY, L101 compare avec ===,
 * L74 tolère ±2 pas, generateTicketCode / verifyTicketCode n'existent pas ;
 * lib/shifts/shift.service.ts:50-55 (même sel) ; totp_secret nullable sans défaut
 * (supabase/migrations/20260906000003_ticket_totp_secret.sql:6-7), jamais renseigné par payment_confirm
 * (20261101000003_lot3_moteur.sql:340-348) ; app/api/tickets/[id]/live-code/route.ts:45-49 sert tout le
 * personnel, L67-76 renvoie qr_payload construit sur le qr_code statique.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { assertAccessInvariants } from '../helpers/access-invariants';
import { inspect } from '../helpers/db';
import { signInAs } from '../helpers/fixtures';
import { getServerEnv, resetServerEnvCache } from '../../lib/env';
import { routeContext } from './helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { importModule, newBuyer, type Buyer, type SaleEvent } from './paiement-helpers';
import {
    authed, createTimedEvent, liveCode, newController, scan, scansOf, ticketPayload, ticketRow, type RouteResult,
} from './acces-helpers';

type Row = Record<string, unknown>;

const CATEGORY = `Balcon-${randomUUID().slice(0, 6)}`;
const ROOT = process.cwd();

let partner: TestPartner;
let ev: SaleEvent;
let controller: Buyer;
let buyer: Buyer;
let tickets: Row[] = [];

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`;
}

function camera(user: Buyer, payload: string): Promise<RouteResult> {
    return scan(user, { eventId: ev.eventId, payload });
}

function read(rel: string): string {
    return fs.readFileSync(path.resolve(ROOT, rel), 'utf8');
}

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

function asUser(userId: string, accessToken: string): Buyer {
    return { userId, accessToken, email: '', phoneE164: '', phone9: '', firstName: '', lastName: '' };
}

async function assertNotConsumed(ticketId: string, label: string): Promise<void> {
    const t = await ticketRow(ticketId);
    assert.equal(t.status, 'VALIDE', `${label} : le billet ne doit pas être composté (statut ${t.status})`);
    const accepted = (await scansOf(ticketId)).filter((s) => s.accepted === true);
    assert.deepEqual(accepted, [], `${label} : aucune ligne ticket_scans acceptée attendue`);
}

/** TOTP « naïf » (HOTP SHA-256 tronqué, 6 chiffres) dont la clé serait la colonne totp_secret seule. */
function naiveCode(key: string | Buffer, step: number): string {
    const counter = Buffer.alloc(8);
    counter.writeBigInt64BE(BigInt(step));
    const h = createHmac('sha256', key).update(counter).digest();
    const o = h[h.length - 1] & 0x0f;
    const bin = ((h[o] & 0x7f) << 24) | ((h[o + 1] & 0xff) << 16) | ((h[o + 2] & 0xff) << 8) | (h[o + 3] & 0xff);
    return String(bin % 1_000_000).padStart(6, '0');
}

async function transferTicket(owner: Buyer, recipient: Buyer, ticketId: string): Promise<void> {
    const { POST: initiate } = await importModule('../../app/api/tickets/[id]/transfer/route');
    const initRes: Response = await initiate(authed(`/api/tickets/${ticketId}/transfer`, 'POST', owner, { recipient: recipient.email }), routeContext({ id: ticketId }));
    const initBody = (await initRes.json()) as Row;
    assert.equal(initRes.status, 200, `initiation du transfert : HTTP ${initRes.status} ${JSON.stringify(initBody)}`);
    const token = String(((initBody.transfer ?? {}) as Row).claim_url ?? '').split('/').filter(Boolean).pop();
    assert.ok(token, `jeton de réclamation absent : ${JSON.stringify(initBody)}`);
    const { POST: claim } = await importModule('../../app/api/tickets/claim/[token]/route');
    const claimRes: Response = await claim(authed(`/api/tickets/claim/${token}`, 'POST', recipient, {}), routeContext({ token }));
    assert.equal(claimRes.status, 200, `réclamation : HTTP ${claimRes.status} ${JSON.stringify(await claimRes.json())}`);
}

before(async () => {
    partner = await newPartner('accestotp');
    ev = await createTimedEvent(partner.partnerId, 'totp', [{ name: CATEGORY, price: 3000, total: 20 }]);
    controller = await newController(partner, ev.eventId, { label: 'totp' });
    buyer = await newBuyer('accestotp');
    tickets = (await buyConfirmed(buyer, ev, [[CATEGORY, 4]])).tickets;
    assert.equal(tickets.length, 4, 'quatre billets émis par le checkout');
});

after(async () => {
    await assertAccessInvariants('acces-totp');
});

describe('4.2 Secrets dédiés (lib/env.ts)', () => {
    const KEYS = ['TICKET_TOTP_MASTER_KEY', 'REGISSEUR_PIN_KEY'] as const;

    /** Exécute fn avec des variables modifiées (undefined = supprimée), puis restaure l'environnement. */
    function withEnv(overrides: Partial<Record<string, string | undefined>>, fn: () => void): void {
        const saved = new Map<string, string | undefined>();
        for (const k of Object.keys(overrides)) saved.set(k, process.env[k]);
        try {
            for (const [k, v] of Object.entries(overrides)) {
                if (v === undefined) delete process.env[k];
                else process.env[k] = v;
            }
            resetServerEnvCache();
            fn();
        } finally {
            for (const [k, v] of Array.from(saved)) {
                if (v === undefined) delete process.env[k];
                else process.env[k] = v;
            }
            resetServerEnvCache();
        }
    }

    test('TICKET_TOTP_MASTER_KEY et REGISSEUR_PIN_KEY présentes dans l’environnement de test et validées au démarrage', () => {
        for (const key of KEYS) {
            assert.ok((process.env[key] ?? '').length >= 32, `${key} absente ou trop courte dans .env.test (à déclarer dans .env.test.example)`);
        }
        resetServerEnvCache();
        const env = getServerEnv() as unknown as Record<string, unknown>;
        for (const key of KEYS) assert.equal(env[key], process.env[key], `getServerEnv() doit exposer ${key}`);
    });

    test('obligatoires, sans repli, d’au moins 32 caractères', () => {
        for (const key of KEYS) {
            withEnv({ [key]: undefined }, () => {
                assert.throws(() => getServerEnv(), new RegExp(key), `getServerEnv doit refuser un environnement sans ${key}`);
            });
            withEnv({ [key]: 'secret-trop-court' }, () => {
                assert.throws(() => getServerEnv(), new RegExp(key), `getServerEnv doit refuser ${key} de moins de 32 caractères`);
            });
        }
    });

    test('distinctes des autres secrets (OTP, hook SMS, service_role) et l’une de l’autre', () => {
        const others = {
            OTP_HASH_SECRET: process.env.OTP_HASH_SECRET,
            SUPABASE_AUTH_HOOK_SECRET: process.env.SUPABASE_AUTH_HOOK_SECRET,
            SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        };
        for (const key of KEYS) {
            for (const [other, value] of Object.entries(others)) {
                if (!value || value.length < 32) continue;
                withEnv({ [key]: value }, () => {
                    assert.throws(() => getServerEnv(), new RegExp(key), `${key} identique à ${other} doit être refusée`);
                });
            }
        }
        withEnv({ REGISSEUR_PIN_KEY: process.env.TICKET_TOTP_MASTER_KEY ?? 'x'.repeat(40), TICKET_TOTP_MASTER_KEY: process.env.TICKET_TOTP_MASTER_KEY ?? 'x'.repeat(40) }, () => {
            assert.throws(() => getServerEnv(), /REGISSEUR_PIN_KEY|TICKET_TOTP_MASTER_KEY/, 'les deux clés doivent être différentes');
        });
    });

    test('déclarées dans .env.example, .env.test.example et docs/deploiement-projet-neuf.md', () => {
        for (const file of ['.env.example', '.env.test.example', 'docs/deploiement-projet-neuf.md']) {
            const src = read(file);
            for (const key of KEYS) assert.ok(src.includes(key), `${key} absente de ${file}`);
        }
        const example = read('.env.test.example');
        for (const key of KEYS) {
            const m = new RegExp(`^${key}=(.*)$`, 'm').exec(example);
            assert.ok(m && m[1].trim().length >= 32, `${key} : valeur factice de 32 caractères au moins dans .env.test.example`);
        }
    });
});

describe('4.2 Code dynamique : implémentation', () => {
    test('lib/security/totp.ts : clé maître dédiée lue par lib/env, ni hook SMS ni service_role, timingSafeEqual', () => {
        const src = stripComments(read('lib/security/totp.ts'));
        assert.ok(!/SUPABASE_AUTH_HOOK_SECRET/.test(src), 'totp.ts ne doit plus lire SUPABASE_AUTH_HOOK_SECRET');
        assert.ok(!/SUPABASE_SERVICE_ROLE_KEY|service_?role/i.test(src), 'totp.ts ne doit plus lire la clé service_role');
        assert.ok(!/process\.env/.test(src), 'totp.ts lit la clé par getServerEnv (lib/env.ts), sans repli');
        assert.ok(/TICKET_TOTP_MASTER_KEY/.test(src), 'totp.ts utilise TICKET_TOTP_MASTER_KEY');
        assert.ok(/timingSafeEqual/.test(src), 'comparaison du code en temps constant (timingSafeEqual)');
        assert.ok(!/deriveTicketTotpSecret/.test(src), 'plus de dérivation du secret depuis l’identifiant seul');
    });

    test('PIN régisseur : REGISSEUR_PIN_KEY, ni hook SMS ni service_role ; aucune autre dérivation depuis ces secrets', () => {
        const shift = stripComments(read('lib/shifts/shift.service.ts'));
        assert.ok(!/SUPABASE_AUTH_HOOK_SECRET|SUPABASE_SERVICE_ROLE_KEY/.test(shift), 'shift.service.ts ne doit plus dériver le PIN du hook SMS ni de la clé service_role');
        assert.ok(/REGISSEUR_PIN_KEY/.test(shift), 'shift.service.ts utilise REGISSEUR_PIN_KEY');
        const offenders: string[] = [];
        const walk = (dir: string) => {
            for (const e of fs.readdirSync(path.resolve(ROOT, dir), { withFileTypes: true })) {
                const rel = `${dir}/${e.name}`;
                if (e.isDirectory()) walk(rel);
                else if (/\.(ts|tsx)$/.test(e.name)) {
                    const src = stripComments(read(rel));
                    if (/deriveTicketTotpSecret/.test(src)) offenders.push(`${rel} : deriveTicketTotpSecret`);
                    if (/SUPABASE_AUTH_HOOK_SECRET/.test(src) && rel !== 'lib/env.ts' && rel !== 'app/api/auth/sms-hook/route.ts') offenders.push(`${rel} : SUPABASE_AUTH_HOOK_SECRET`);
                }
            }
        };
        walk('app');
        walk('lib');
        assert.deepEqual(offenders, [], `secret du hook SMS ou dérivation de secret de billet hors de leur usage :\n${offenders.join('\n')}`);
    });

    test('billet émis par le checkout : totp_secret aléatoire de 64 hexadécimaux ; colonne NOT NULL avec défaut', async () => {
        const secrets = tickets.map((t) => t.totp_secret);
        for (const s of secrets) assert.match(String(s), /^[0-9a-f]{64}$/, `totp_secret du billet émis : ${s}`);
        assert.equal(new Set(secrets).size, secrets.length, 'un secret différent par billet');
        const col = await inspect(async (db) => (await db.query<{ is_nullable: string; column_default: string | null }>(
            `SELECT is_nullable, column_default FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'totp_secret'`)).rows[0]);
        assert.ok(col, 'colonne tickets.totp_secret');
        assert.equal(col.is_nullable, 'NO', 'tickets.totp_secret NOT NULL');
        assert.ok(col.column_default, 'tickets.totp_secret a une valeur par défaut (billets émis par toute voie)');
    });

    test('verifyTicketCode : pas de 20 s, tolérance ±1 pas, code de plus de 40 s refusé, code d’un autre billet refusé', async () => {
        const totp = await importModule('../../lib/security/totp');
        assert.equal(totp.TOTP_STEP_SECONDS, 20);
        const id = String(tickets[0].id);
        const secret = String(tickets[0].totp_secret);
        const now = new Date();
        const at = (ms: number) => new Date(now.getTime() + ms);
        const code: string = totp.generateTicketCode(id, secret, now);
        assert.match(code, /^\d{6}$/);
        assert.equal(totp.verifyTicketCode(id, secret, code, now), true, 'code courant');
        assert.equal(totp.verifyTicketCode(id, secret, totp.generateTicketCode(id, secret, at(-15_000)), now), true, 'code de −15 s accepté');
        assert.equal(totp.verifyTicketCode(id, secret, totp.generateTicketCode(id, secret, at(15_000)), now), true, 'code de +15 s accepté');
        assert.equal(totp.verifyTicketCode(id, secret, totp.generateTicketCode(id, secret, at(-45_000)), now), false, 'code de −45 s refusé');
        assert.equal(totp.verifyTicketCode(id, secret, totp.generateTicketCode(id, secret, at(45_000)), now), false, 'code de +45 s refusé');
        const otherId = String(tickets[1].id);
        const otherCode: string = totp.generateTicketCode(otherId, String(tickets[1].totp_secret), now);
        if (otherCode !== code) assert.equal(totp.verifyTicketCode(id, secret, otherCode, now), false, 'le code d’un autre billet est refusé');
        assert.equal(totp.verifyTicketCode(id, secret, '12345', now), false, 'format invalide refusé');
    });
});

describe('4.2 Code dynamique au scan', () => {
    test('code de plus de 40 s (passé ou futur) → qr_expired, non composté ; code de −15 s → valid', async () => {
        const id = String(tickets[0].id);
        for (const offset of [-45_000, 45_000]) {
            const r = await camera(controller, await ticketPayload(id, new Date(Date.now() + offset)));
            assert.equal(r.status, 200, show(r));
            assert.equal(r.body.result, 'qr_expired', `code décalé de ${offset / 1000} s : ${show(r)}`);
        }
        await assertNotConsumed(id, 'codes expirés');
        const ok = await camera(controller, await ticketPayload(id, new Date(Date.now() - 15_000)));
        assert.equal(ok.body.result, 'valid', `code de −15 s : ${show(ok)}`);
        assert.equal((await ticketRow(id)).status, 'UTILISE');
    });

    test('la colonne seule ne permet pas de calculer un code : TOTP « naïf » sur totp_secret refusé', async () => {
        const totp = await importModule('../../lib/security/totp');
        const t = tickets[1];
        const id = String(t.id);
        const secret = String(t.totp_secret);
        const now = Date.now();
        const legit = new Set([-20_000, 0, 20_000].map((d) => String(totp.generateTicketCode(id, secret, new Date(now + d)))));
        const step = Math.floor(now / 20_000);
        const naive = new Set<string>();
        for (const key of [secret, Buffer.from(secret, 'hex')]) {
            for (const s of [step - 1, step, step + 1]) naive.add(naiveCode(key, s));
        }
        for (const code of Array.from(naive)) {
            if (legit.has(code)) continue;
            const r = await camera(controller, totp.buildTicketPayload(id, code));
            assert.equal(r.body.result, 'qr_expired', `code naïf ${code} : ${show(r)}`);
        }
        await assertNotConsumed(id, 'codes naïfs');
        const ok = await camera(controller, await ticketPayload(id));
        assert.equal(ok.body.result, 'valid', `code légitime : ${show(ok)}`);
    });

    test('transfert : code de l’ancien secret refusé, ancien porteur sans live-code, nouveau porteur accepté', async () => {
        const totp = await importModule('../../lib/security/totp');
        const id = String(tickets[2].id);
        const oldSecret = String((await ticketRow(id)).totp_secret);
        const recipient = await newBuyer('accestotpdest');
        await transferTicket(buyer, recipient, id);
        const newSecret = String((await ticketRow(id)).totp_secret);
        assert.notEqual(newSecret, oldSecret, 'totp_secret régénéré au transfert');

        const oldPayload = totp.buildTicketPayload(id, totp.generateTicketCode(id, oldSecret, new Date()));
        const byOld = await camera(controller, oldPayload);
        assert.equal(byOld.body.result, 'qr_expired', `code de l’ancien secret : ${show(byOld)}`);
        await assertNotConsumed(id, 'ancien secret après transfert');

        const oldOwner = await liveCode(buyer, id);
        assert.equal(oldOwner.status, 404, `ancien porteur : ${show(oldOwner)}`);
        const holder = await liveCode(recipient, id);
        assert.equal(holder.status, 200, `nouveau porteur : ${show(holder)}`);
        const byNew = await camera(controller, String(holder.body.payload));
        assert.equal(byNew.body.result, 'valid', `code du nouveau porteur : ${show(byNew)}`);
    });
});

describe('4.2 live-code', () => {
    test('porteur : payload EVT1:<UUID>:<6 chiffres>, step_seconds 20, expires_in du serveur ; payload accepté au scan', async () => {
        const totp = await importModule('../../lib/security/totp');
        const t = tickets[3];
        const id = String(t.id);
        const r = await liveCode(buyer, id);
        assert.equal(r.status, 200, show(r));
        const payload = String(r.body.payload);
        assert.match(payload, new RegExp(`^EVT1:${id}:\\d{6}$`), `payload du live-code : ${show(r)}`);
        assert.equal(r.body.step_seconds, 20);
        const expiresIn = Number(r.body.expires_in);
        assert.ok(Number.isInteger(expiresIn) && expiresIn >= 1 && expiresIn <= 20, `expires_in entre 1 et 20 s : ${r.body.expires_in}`);
        assert.ok(!JSON.stringify(r.body).includes(String(t.qr_code)), 'le qr_code statique ne sort plus');
        assert.ok(!JSON.stringify(r.body).includes(String(t.totp_secret)), 'le secret ne sort jamais');
        assert.equal(totp.verifyTicketCode(id, String(t.totp_secret), payload.split(':')[2], new Date()), true, 'code vérifiable par le serveur');
    });

    test('tout autre compte → 404 : autre client, contrôleur affecté, partenaire propriétaire, administrateur', async () => {
        const id = String(tickets[3].id);
        const other = await newBuyer('accestotpautre');
        const admin = await signInAs('ADMIN');
        const accounts: Array<[string, Buyer]> = [
            ['autre client', other],
            ['contrôleur affecté', controller],
            ['partenaire propriétaire', partner],
            ['administrateur', asUser(admin.userId, admin.accessToken)],
        ];
        for (const [label, user] of accounts) {
            const r = await liveCode(user, id);
            assert.equal(r.status, 404, `${label} : ${show(r)}`);
            assert.ok(!JSON.stringify(r.body).includes('EVT1'), `${label} : aucun payload`);
        }
    });

    test('billet composté : plus de live-code', async () => {
        const id = String(tickets[3].id);
        const ok = await camera(controller, await ticketPayload(id));
        assert.equal(ok.body.result, 'valid', show(ok));
        const r = await liveCode(buyer, id);
        assert.notEqual(r.status, 200, `billet UTILISE : ${show(r)}`);
        assert.ok(!JSON.stringify(r.body).includes('EVT1'), 'aucun payload pour un billet composté');
    });
});
