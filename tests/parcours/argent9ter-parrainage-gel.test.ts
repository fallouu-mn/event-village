/**
 * Lot 9 ter, tâche 9t.7 (consigne 0.7, contrat A.5) — commissions de parrainage d'un événement suspendu.
 *  - fin_frozen_amount(p_owner, 'PARRAINAGE', p_at) gèle, à la lecture, le net échu des commissions dont l'événement
 *    est SUSPENDU : événement de l'écriture, à défaut celui du paiement (crédits au prorata, annulations,
 *    régularisations) ; sans événement ni paiement d'événement : jamais gelé ; dégel à la reprise, sans écriture ;
 *  - fin_withdrawal_check refuse FUNDS_FROZEN avec un texte juste pour un parrain (« Une partie de vos commissions est
 *    gelée : … ») ; le texte ORGANISATEUR est inchangé ;
 *  - GET /api/finance/balance?account=PARRAINAGE sert `frozen` et réduit `withdrawable` ; POST /api/withdrawals/otp
 *    refuse 409 FUNDS_FROZEN sans SMS ni code ;
 *  - le portefeuille affiche le bandeau « Commissions gelées » (statique).
 * Rouge avant correctif (fix(9t.7), M05 ; fix(9t.7e)) : fin_frozen_amount rend 0 pour PARRAINAGE
 * (M/20261109000006:215-217), donc gel nul, retrait accepté, code envoyé ; app/wallet/page.tsx ne lit pas `frozen`.
 * Cas 3 (oracle des branches) dans une transaction annulée : ORGANISATEUR comparé à la requête de base (non-régression,
 * vert dès l'écriture) ; (iii), (iv), (v) valent 0 aujourd'hui comme après ; (i) et (ii) rougissent.
 * Montage : parrain → filleul (patron chain de commissions-fin-evenement), événement à 30 jours, catégorie à 20 000 F,
 * achat du filleul → commission N1 (précondition : au moins 2 F) ; minimum de retrait réglé à 1 F le temps des cas.
 * Suspension et reprise par event_transition (SUPERADMIN du seed), reprise toujours faite en finally ; une commission
 * vieillie (cas 2) est réalignée en finally (referral_commissions_realign), sinon w18. Aucun vrai retrait (devis
 * withdrawal_quote seulement, rectification A.6). Fin de suite : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { getFakes } from '../fakes';
import { inRolledBackTransaction } from '../helpers/db';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { assertRpcOk, rpcTransition } from './cycle-helpers';
import {
    buyConfirmed, createPartnerEvent, jsonRequest, ledgerOf, newPartner, superadminId, withSettings,
    type TestPartner,
} from './finance-helpers';
import { fakePay, newBuyer, service, setFakeMode, type Buyer, type SaleEvent } from './paiement-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';

type Row = Record<string, unknown>;

const DAY_MS = 24 * 3600 * 1000;
const PRICE = 20_000;
const BALANCE_ROUTE = '../../app/api/finance/balance/route';
const OTP_ROUTE = '../../app/api/withdrawals/otp/route';
const WALLET = 'app/wallet/page.tsx';
const SPONSOR_FROZEN_TEXT = 'Une partie de vos commissions est gelée : un événement pour lequel vos filleuls ont acheté des billets est suspendu.';
const BANNER_TEXT = 'Un événement pour lequel vos filleuls ont acheté des billets est suspendu : ces commissions ne sont pas retirables tant qu’il l’est.';
const SUSPEND_REASON = 'Suspension de test du lot 9 ter (gel des commissions)';

let partner: TestPartner;

before(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = 10_000_000;
    partner = await newPartner('9ter-parrainage-gel');
});

after(async () => {
    await assertLot9terInvariants('argent9ter-parrainage-gel');
});

// ── Montage ────────────────────────────────────────────────────────────────

const cents = (x: unknown): number => Math.round(Number(x) * 100);

/** Parrain → filleul, grille STANDARD client à client (5 %), comme l'inscription ; un couple neuf par cas. */
async function chain(label: string): Promise<{ sponsor: Buyer; filleul: Buyer }> {
    const sponsor = await newBuyer(`9ter-gel-${label}-p`, { firstName: 'Ibrahima', lastName: 'Parrain' });
    const filleul = await newBuyer(`9ter-gel-${label}-f`, { firstName: 'Khady', lastName: 'Filleule' });
    const { error } = await service.from('referral_relationships').insert({
        sponsor_id: sponsor.userId, referred_id: filleul.userId, referral_type: 'CLIENT_TO_CLIENT', sponsor_status_at_creation: 'STANDARD',
        rate_n1_at_creation: 5, rate_n2_at_creation: 2, duration_months: 12,
        expires_at: new Date(Date.now() + 365 * DAY_MS).toISOString(), is_active: true,
    });
    assert.equal(error, null, `relation de parrainage : ${error?.message}`);
    return { sponsor, filleul };
}

/** Fin de l'événement telle que saisie (date et heure de fin, heure de Dakar = UTC). */
async function eventEndMs(eventId: string): Promise<number> {
    const { data, error } = await service.from('events').select('end_date, end_time').eq('id', eventId).single();
    assert.equal(error, null, `dates de l'événement ${eventId} : ${error?.message}`);
    assert.ok(data.end_date && data.end_time, `précondition : date et heure de fin saisies (${JSON.stringify(data)})`);
    const t = String(data.end_time);
    return Date.parse(`${String(data.end_date)}T${t.length === 5 ? `${t}:00` : t}Z`);
}

interface Scene { sponsor: Buyer; ev: SaleEvent; commission: Row; amount: number; endMs: number }

/** Événement à 30 jours, achat du filleul, commission N1 du parrain (seule écriture de son compte PARRAINAGE). */
async function commissionScene(label: string): Promise<Scene> {
    const ev = await createPartnerEvent(partner.partnerId, `9ter gel ${label}`, [{ name: 'Standard', price: PRICE, total: 20 }], { daysFromNow: 30 });
    const { sponsor, filleul } = await chain(label);
    const p = await buyConfirmed(filleul, ev, [['Standard', 1]]);
    const { data, error } = await service.from('referral_commissions').select('*').eq('payment_id', p.payment.id).eq('sponsor_id', sponsor.userId).eq('generation', 'N1');
    assert.equal(error, null, `commission du paiement ${p.payment.id} : ${error?.message}`);
    assert.equal((data ?? []).length, 1, `une commission N1 pour le paiement ${p.payment.id} : ${JSON.stringify(data)}`);
    const commission = (data ?? [])[0] as Row;
    const amount = Number(commission.amount);
    assert.ok(amount >= 2, `précondition : commission d’au moins 2 F (frais de retrait compris) : ${amount}`);
    const ledger = await ledgerOf(sponsor.userId, 'PARRAINAGE');
    assert.deepEqual(ledger.map((e) => [e.entry_type, cents(e.amount), e.event_id]), [['COMMISSION', cents(amount), ev.eventId]],
        `précondition : une seule écriture COMMISSION, rattachée à l’événement : ${JSON.stringify(ledger)}`);
    return { sponsor, ev, commission, amount, endMs: await eventEndMs(ev.eventId) };
}

async function frozenOf(ownerId: string, kind: 'ORGANISATEUR' | 'PARRAINAGE', at: string): Promise<number> {
    const { data, error } = await service.rpc('fin_frozen_amount', { p_owner: ownerId, p_kind: kind, p_at: at });
    assert.equal(error, null, `fin_frozen_amount : ${error?.message}`);
    return Number(data);
}

async function withdrawalCheck(ownerId: string, gross: number, at: string): Promise<Row> {
    const { data, error } = await service.rpc('fin_withdrawal_check', { p_user: ownerId, p_kind: 'PARRAINAGE', p_gross: gross, p_at: at });
    assert.equal(error, null, `fin_withdrawal_check : ${error?.message}`);
    return (data ?? {}) as Row;
}

async function suspend(eventId: string): Promise<void> {
    assertRpcOk(await rpcTransition(eventId, await superadminId(), 'SUSPENDU', SUSPEND_REASON), `suspension de l'événement ${eventId} par l'admin`);
}

/** Reprise SUSPENDU → PUBLIE, seulement si l'événement est encore suspendu (appelée en finally). */
async function resume(eventId: string): Promise<void> {
    const { data, error } = await service.from('events').select('status').eq('id', eventId).single();
    assert.equal(error, null, `statut de l'événement ${eventId} : ${error?.message}`);
    if (data.status !== 'SUSPENDU') return;
    assertRpcOk(await rpcTransition(eventId, await superadminId(), 'PUBLIE'), `reprise de l'événement ${eventId} par l'admin`);
}

/** Commission « vieillie » : disponible depuis une minute, écriture comprise (patron commissions-fin-evenement:115-122). */
async function ageToAvailable(c: Row): Promise<void> {
    const past = new Date(Date.now() - 60_000).toISOString();
    const { error } = await service.from('referral_commissions').update({ status: 'AVAILABLE', available_at: past }).eq('id', c.id);
    assert.equal(error, null, `commission ${String(c.id)} vieillie : ${error?.message}`);
    const { error: lErr } = await service.from('finance_ledger').update({ available_at: past }).eq('commission_id', c.id).eq('entry_type', 'COMMISSION');
    assert.equal(lErr, null, `écriture COMMISSION vieillie : ${lErr?.message}`);
}

async function realign(eventId: string): Promise<void> {
    const { error } = await service.rpc('referral_commissions_realign', { p_event: eventId });
    assert.equal(error, null, `referral_commissions_realign : ${error?.message} (code ${error?.code})`);
}

async function withdrawalOtpRows(phoneE164: string): Promise<number> {
    const { data, error } = await service.from('otp_codes').select('id').eq('phone', phoneE164).eq('purpose', 'WITHDRAWAL');
    assert.equal(error, null, `codes de retrait : ${error?.message}`);
    return (data ?? []).length;
}

function num(body: Row, key: string, what: string): number {
    assert.ok(key in body, `${what} : clé « ${key} » absente — reçu ${JSON.stringify(body).slice(0, 600)}`);
    const n = Number(body[key]);
    assert.ok(Number.isFinite(n), `${what} : ${key} non numérique (${JSON.stringify(body[key])})`);
    return n;
}

// ── Cas ────────────────────────────────────────────────────────────────────

describe('0.7 — commissions de parrainage d’un événement suspendu (lot 9 ter, 9t.7)', () => {
    test('gel à la lecture : événement suspendu → commission gelée ; reprise → dégel', async () => {
        const s = await commissionScene('lecture');
        const pAt = new Date(s.endMs + 8 * DAY_MS).toISOString();
        const gross = Math.floor(s.amount);
        assert.equal(await frozenOf(s.sponsor.userId, 'PARRAINAGE', pAt), 0, 'témoin : rien de gelé tant que l’événement est publié');
        await withSettings({ 'finance.withdrawal_min_amount': 1 }, async () => {
            await suspend(s.ev.eventId);
            try {
                assert.equal(cents(await frozenOf(s.sponsor.userId, 'PARRAINAGE', pAt)), cents(s.amount),
                    'événement suspendu : la commission de parrainage est gelée (aujourd’hui 0, M/20261109000006:215-217)');
                const check = await withdrawalCheck(s.sponsor.userId, gross, pAt);
                assert.deepEqual({ ok: check.ok, code: check.code, message: check.message }, { ok: false, code: 'FUNDS_FROZEN', message: SPONSOR_FROZEN_TEXT },
                    `retrait du parrain refusé, texte juste pour un parrain : ${JSON.stringify(check)}`);
            } finally {
                await resume(s.ev.eventId);
            }
            assert.equal(await frozenOf(s.sponsor.userId, 'PARRAINAGE', pAt), 0, 'reprise : dégel sans écriture');
            const after1 = await withdrawalCheck(s.sponsor.userId, gross, pAt);
            assert.equal(after1.ok, true, `reprise : retrait du parrain de nouveau possible : ${JSON.stringify(after1)}`);
        });
        assert.equal((await ledgerOf(s.sponsor.userId, 'PARRAINAGE')).length, 1, 'gel et dégel calculés à la lecture : aucune écriture');
    });

    test('routes : solde et code de retrait du parrain pendant la suspension, aucun SMS', async () => {
        const s = await commissionScene('routes');
        const gross = Math.floor(s.amount);
        await ageToAvailable(s.commission);
        const smsBefore = getFakes().sms.messagesTo(s.sponsor.phoneE164).length;
        const otpBefore = await withdrawalOtpRows(s.sponsor.phoneE164);
        try {
            await withSettings({ 'finance.withdrawal_min_amount': 1 }, async () => {
                await suspend(s.ev.eventId);
                const balanceHandler = await routeHandler(BALANCE_ROUTE, 'GET', 'GET /api/finance/balance');
                const b = await invoke(balanceHandler, jsonRequest('/api/finance/balance?account=PARRAINAGE', 'GET', s.sponsor.accessToken));
                assert.equal(b.status, 200, `solde PARRAINAGE : ${show(b)}`);
                const available = num(b.body, 'available', 'GET /api/finance/balance');
                assert.equal(cents(available), cents(s.amount), `available inchangé (commission échue) : ${show(b)}`);
                assert.equal(cents(num(b.body, 'frozen', 'GET /api/finance/balance')), cents(s.amount), `frozen = commission de l’événement suspendu (aujourd’hui 0) : ${show(b)}`);
                assert.equal(num(b.body, 'withdrawable', 'GET /api/finance/balance'), Math.floor(Math.max(available - s.amount, 0)), `withdrawable réduit du gel : ${show(b)}`);

                const otpHandler = await routeHandler(OTP_ROUTE, 'POST', 'POST /api/withdrawals/otp');
                const otp = await invoke(otpHandler, jsonRequest('/api/withdrawals/otp', 'POST', s.sponsor.accessToken, { account: 'PARRAINAGE', amount: gross }));
                assert.equal(otp.status, 409, `code de retrait refusé pendant la suspension (aujourd’hui 200 et SMS) : ${show(otp)}`);
                assert.deepEqual({ code: otp.body.code, error: otp.body.error }, { code: 'FUNDS_FROZEN', error: SPONSOR_FROZEN_TEXT }, show(otp));
                assert.equal(getFakes().sms.messagesTo(s.sponsor.phoneE164).length, smsBefore, 'aucun SMS au parrain');
                assert.equal(await withdrawalOtpRows(s.sponsor.phoneE164), otpBefore, 'aucun code de retrait enregistré');

                await resume(s.ev.eventId);
                const { data, error } = await service.rpc('withdrawal_quote', { p: { user_id: s.sponsor.userId, account_kind: 'PARRAINAGE', gross_amount: gross } });
                assert.equal(error, null, `withdrawal_quote : ${error?.message}`);
                assert.equal((data as Row | null)?.ok, true, `reprise : devis de retrait accepté : ${JSON.stringify(data)}`);
            });
        } finally {
            await resume(s.ev.eventId);
            await realign(s.ev.eventId);
        }
    });

    test('oracle des branches, transaction annulée', async () => {
        // Hors transaction : événements E1 (une vente, garde désactivée), E2, E3 de la partenaire ; compte de parrainage neuf.
        const e1 = await createPartnerEvent(partner.partnerId, '9ter gel oracle E1', [{ name: 'Standard', price: 5_000, total: 10 }]);
        const e2 = await createPartnerEvent(partner.partnerId, '9ter gel oracle E2', [{ name: 'Standard', price: 5_000, total: 10 }]);
        const e3 = await createPartnerEvent(partner.partnerId, '9ter gel oracle E3', [{ name: 'Standard', price: 5_000, total: 10 }]);
        const buyer = await newBuyer('9ter-gel-oracle-ach');
        const sale = await withSettings({ 'finance.payout_hold_enabled': false }, () => buyConfirmed(buyer, e1, [['Standard', 1]]));
        const owner = await newBuyer('9ter-gel-oracle-parrain');
        const admin = await superadminId();

        const result = await inRolledBackTransaction(async (db) => {
            for (const ev of [e1, e2]) {
                const { rows } = await db.query('SELECT public.event_transition($1::jsonb) AS r',
                    [JSON.stringify({ event_id: ev.eventId, actor_id: admin, to_status: 'SUSPENDU', reason: SUSPEND_REASON })]);
                assert.equal((rows[0].r as Row).ok, true, `suspension de ${ev.eventId} : ${JSON.stringify(rows[0].r)}`);
            }
            // E3 terminé comme le ferait le cron (journal de la même transaction, exigé par trg_events_status_guard)
            await db.query(`INSERT INTO public.event_status_history (event_id, old_status, new_status, actor_role, reason, channel)
                            VALUES ($1, 'PUBLIE', 'TERMINE', 'SYSTEM', 'Fin de test du lot 9 ter', 'CRON')`, [e3.eventId]);
            await db.query(`UPDATE public.events SET status = 'TERMINE' WHERE id = $1`, [e3.eventId]);

            const at = "now() - interval '1 hour'";
            const insert = async (entryType: string, amount: number, eventId: string | null, paymentId: string | null): Promise<void> => {
                await db.query(`INSERT INTO public.finance_ledger (owner_id, account_kind, entry_type, amount, available_at, event_id, payment_id, source_key, description)
                                VALUES ($1, 'PARRAINAGE', $2, $3, ${at}, $4, $5, $6, 'Écriture de test du lot 9 ter (oracle du gel)')`,
                [owner.userId, entryType, amount, eventId, paymentId, `TEST9TER-GEL-${randomUUID()}`]);
            };
            const frozen = async (ownerId: string, kind: string): Promise<number> => {
                const { rows } = await db.query(`SELECT public.fin_frozen_amount($1, $2, now() + interval '1 minute') AS v`, [ownerId, kind]);
                return Number(rows[0].v);
            };

            const out: Record<string, number> = { depart: await frozen(owner.userId, 'PARRAINAGE') };
            await insert('COMMISSION', 10, null, null);
            out['(iii) sans événement ni paiement'] = await frozen(owner.userId, 'PARRAINAGE');
            await insert('COMMISSION', 20, e3.eventId, null);
            out['(iv) événement TERMINE'] = await frozen(owner.userId, 'PARRAINAGE');
            await insert('COMMISSION', 30, e1.eventId, null);
            out['(i) événement SUSPENDU'] = await frozen(owner.userId, 'PARRAINAGE');
            await insert('COMMISSION', 40, null, sale.payment.id);
            out['(ii) paiement d’un événement SUSPENDU'] = await frozen(owner.userId, 'PARRAINAGE');
            await insert('COMMISSION', 5, e2.eventId, null);
            await insert('COMMISSION_ANNULEE', -15, e2.eventId, null);
            out['(v) net négatif d’un événement SUSPENDU'] = await frozen(owner.userId, 'PARRAINAGE');

            // ORGANISATEUR : même résultat que la requête de base (M/20261109000006:218-227), non-régression
            const { rows: base } = await db.query(`
                SELECT COALESCE(sum(GREATEST(n.net, 0)), 0) AS v
                  FROM (SELECT l.event_id, sum(l.amount) AS net
                          FROM public.finance_ledger l
                          JOIN public.events e ON e.id = l.event_id
                         WHERE l.owner_id = $1 AND l.account_kind = 'ORGANISATEUR'
                           AND e.status::text = 'SUSPENDU'
                           AND l.available_at <= now() + interval '1 minute'
                         GROUP BY l.event_id) n`, [partner.userId]);
            return { parrainage: out, organisateurBase: Number(base[0].v), organisateur: await frozen(partner.userId, 'ORGANISATEUR') };
        });

        assert.ok(result.organisateurBase > 0, `précondition : la vente de E1 donne un net ORGANISATEUR gelé (${result.organisateurBase})`);
        assert.equal(cents(result.organisateur), cents(result.organisateurBase), 'ORGANISATEUR : même résultat que la requête de base');
        assert.deepEqual(result.parrainage, {
            depart: 0,
            '(iii) sans événement ni paiement': 0,
            '(iv) événement TERMINE': 0,
            '(i) événement SUSPENDU': 30,
            '(ii) paiement d’un événement SUSPENDU': 70,
            '(v) net négatif d’un événement SUSPENDU': 70,
        }, 'gel PARRAINAGE par branche (aujourd’hui 0 partout)');
    });

    test('portefeuille : bandeau Commissions gelées sous frozen > 0', () => {
        const abs = path.join(process.cwd(), ...WALLET.split('/'));
        assert.ok(fs.existsSync(abs), `${WALLET} absent : le contrôle ne prouverait rien`);
        const src = fs.readFileSync(abs, 'utf8');
        const sf = ts.createSourceFile(WALLET, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        const norm = (s: string): string => s.replace(/[’‘]/g, '\'').replace(/&apos;|&#39;|&rsquo;/g, '\'').replace(/[\s  ]+/g, ' ').trim();
        const nodes: ts.Node[] = [];
        const visit = (n: ts.Node): void => {
            nodes.push(n);
            ts.forEachChild(n, visit);
        };
        visit(sf);

        assert.ok(nodes.some((n) => ts.isPropertyAccessExpression(n) && n.getText(sf) === 'body.frozen'), `${WALLET} ne lit pas body.frozen (servi par GET /api/finance/balance)`);
        const banners = nodes.filter((n): n is ts.JsxElement => ts.isJsxElement(n) && n.openingElement.tagName.getText(sf) === 'StatusBanner'
            && n.openingElement.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === 'tone' && a.initializer !== undefined && a.initializer.getText(sf) === '"suspended"'));
        const frozenBanners = banners.filter((b) => /Commissions gelées : \$\{formatFcfa\([^)]*\bfrozen\)\}\./.test(b.getText(sf)));
        assert.equal(frozenBanners.length, 1, `${WALLET} : un StatusBanner tone="suspended" titré « Commissions gelées : {montant}. » attendu (${frozenBanners.length})`);
        const banner = frozenBanners[0];
        const text = norm(banner.children.map((c) => (ts.isJsxText(c) ? c.text : ts.isJsxExpression(c) && c.expression && ts.isStringLiteralLike(c.expression) ? c.expression.text : '')).join(' '));
        assert.equal(text, norm(BANNER_TEXT), `${WALLET} : texte du bandeau`);
        let guarded = false;
        for (let p: ts.Node | undefined = banner.parent; p && !guarded && p !== sf; p = p.parent) {
            if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) guarded = /\bfrozen\s*>\s*0\b/.test(p.left.getText(sf));
            else if (ts.isConditionalExpression(p)) guarded = /\bfrozen\s*>\s*0\b/.test(p.condition.getText(sf));
        }
        assert.ok(guarded, `${WALLET} : bandeau rendu sans condition frozen > 0`);
    });
});
