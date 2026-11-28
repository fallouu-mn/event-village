/**
 * Contre-vérification du lot 12d — aides communes aux suites cv12d-1-trous et cv12d-2-gardes (base LOCALE, faux
 * SamirPay, faux SMS). Branche lot12d/cv-rouges, jamais fusionnée. Les montants attendus sont calculés à la main dans
 * chaque test, jamais par ces aides.
 */
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { openConcurrentClient } from '../helpers/db';
import { stepUpTestSession } from '../helpers/admin-step-up';
import { BASE_URL } from '../parcours/helpers';
import {
    addCourier, courierAct, newBuyer, newDeliveryZone, newPartner, newProduct, newShop, orderBody, partnerAct, payOrder, placed,
    service, toReady, type Buyer, type Row, type TestPartner,
} from '../parcours/l12a-helpers';

export interface World {
    partner: TestPartner;
    partnerB: TestPartner;
    client: Buyer;
    stranger: Buyer;
    courier: Buyer;
    courier2: Buyer;
    adminRefund: Buyer;
    adminPay: Buyer;
    adminNone: Buyer;
    shop: string;
    zone: string;
}

export async function newAdmin(label: string, permissions: string[]): Promise<Buyer> {
    const user = await newBuyer(`cv12d-${label}`, { firstName: 'Ndeye', lastName: 'Equipe' });
    const { error } = await service.from('user_roles').upsert([{ user_id: user.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
    assert.equal(error, null, `rôle ADMIN : ${error?.message}`);
    for (const permission of permissions) {
        const { error: pErr } = await service.from('admin_permissions').upsert({ user_id: user.userId, permission }, { onConflict: 'user_id,permission' });
        assert.equal(pErr, null, `permission ${permission} : ${pErr?.message}`);
    }
    await stepUpTestSession(user.accessToken);
    return user;
}

export async function buildWorld(label: string): Promise<World> {
    const partner = await newPartner(`cv12d-${label}`);
    const partnerB = await newPartner(`cv12d-${label}-b`);
    const client = await newBuyer(`cv12d-${label}-client`, { firstName: 'Khady', lastName: 'Sarrdiop' });
    const stranger = await newBuyer(`cv12d-${label}-autre`);
    const courier = await newBuyer(`cv12d-${label}-livreur`, { firstName: 'Moussa', lastName: 'Diallo' });
    const courier2 = await newBuyer(`cv12d-${label}-livreur2`, { firstName: 'Ibou', lastName: 'Ndour' });
    const shop = await newShop(partner, { depositAllowed: true, depositPercent: 30, payOnHandover: true });
    const zone = await newDeliveryZone(shop, 1_000, 0, 'Plateau');
    await addCourier(partner, courier);
    await addCourier(partner, courier2);
    const adminRefund = await newAdmin(`${label}-remb`, ['refunds.manage']);
    const adminPay = await newAdmin(`${label}-paie`, ['payments.read']);
    const adminNone = await newAdmin(`${label}-evts`, ['events.read']);
    return { partner, partnerB, client, stranger, courier, courier2, adminRefund, adminPay, adminNone, shop, zone };
}

export function req(path: string, method: string, token: string | null, body?: unknown): NextRequest {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    if (token) h.authorization = `Bearer ${token}`;
    return new NextRequest(`${BASE_URL}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
}
export const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

export async function reply(res: Response): Promise<{ status: number; body: Row; text: string }> {
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? (JSON.parse(text) as Row) : {};
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body, text };
}

/** Requête SQL directe (connexion à part, garde des commandes ouverte le temps de la requête). */
export async function sql<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
    const c = await openConcurrentClient({ applicationName: 'ev-test-cv12d' });
    try {
        await c.query(`SELECT set_config('event_village.order_flow', 'on', true)`);
        const { rows } = await c.query<T>(text, params);
        await c.commit();
        return rows;
    } finally {
        await c.close();
    }
}

export async function rpc(name: string, p: Row): Promise<Row> {
    const { data, error } = await service.rpc(name, { p });
    assert.equal(error, null, `${name} : ${error?.message}`);
    return data as Row;
}

export const delivery = (w: World, who: Buyer = w.client): Row => ({ mode: 'LIVRAISON', zoneId: w.zone, address: 'Villa 12, route des Almadies', phone: who.phone9 });

/** Livraison payée confiée à `by` (livreur principal par défaut), prête ; `go` : partie (en route). */
export async function delivered(w: World, opts: { who?: Buyer; payment?: 'INTEGRAL' | 'ACOMPTE'; price?: number; go?: boolean; by?: Buyer } = {}): Promise<string> {
    const who = opts.who ?? w.client;
    const product = await newProduct(w.partner, w.shop, { price: opts.price ?? 4_000 });
    const id = await placed(who, orderBody(w.shop, [{ productId: product, quantity: 1 }], { ...delivery(w, who), payment: opts.payment ?? 'INTEGRAL' }));
    await payOrder(who, id);
    await toReady(w.partner, id);
    const assign = await partnerAct(w.partner, id, { action: 'CONFIER', courierId: (opts.by ?? w.courier).userId });
    assert.equal(assign.status, 200, JSON.stringify(assign.body));
    if (opts.go !== false) {
        const go = await courierAct(opts.by ?? w.courier, id, { action: 'EN_ROUTE', minutes: 20 });
        assert.equal(go.status, 200, JSON.stringify(go.body));
    }
    return id;
}

/** Deux appels comptés (le second 31 s « après » le premier). */
export async function twoCalls(who: Buyer, id: string): Promise<void> {
    assert.equal((await courierAct(who, id, { action: 'APPEL' })).status, 200);
    await sql(`UPDATE public.orders SET last_call_at = now() - interval '31 seconds' WHERE id = $1`, [id]);
    const second = await courierAct(who, id, { action: 'APPEL' });
    assert.equal((second.body.order as Row).calls, 2, JSON.stringify(second.body));
}

/** Livraison en route, client signalé absent, attente échue, passée à l'équipe (order_watch_tick). */
export async function escalated(w: World, opts: { price?: number; payment?: 'INTEGRAL' | 'ACOMPTE' } = {}): Promise<string> {
    const id = await delivered(w, opts);
    await twoCalls(w.courier, id);
    const absent = await courierAct(w.courier, id, { action: 'ABSENT' });
    assert.equal(absent.status, 200, JSON.stringify(absent.body));
    await sql(`UPDATE public.orders SET absent_wait_until = now() - interval '1 minute' WHERE id = $1`, [id]);
    const { error } = await service.rpc('order_watch_tick');
    assert.equal(error, null, error?.message);
    const [o] = await sql<{ absent_escalated_at: string | null }>(`SELECT absent_escalated_at FROM public.orders WHERE id = $1`, [id]);
    assert.ok(o.absent_escalated_at, 'absence passée à l’équipe');
    return id;
}

/** Fin propre d'une commande encore ouverte (annulation par la partenaire) : aucune commande ouverte laissée derrière. */
export async function closeIfOpen(w: World, id: string): Promise<void> {
    const [o] = await sql<{ order_state: string }>(`SELECT order_state FROM public.orders WHERE id = $1`, [id]);
    if (o && ['RECUE', 'ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'EN_ROUTE'].includes(o.order_state)) {
        const r = await rpc('order_cancel', { order_id: id, actor_id: w.partner.userId, origin: 'PARTENAIRE', reason: 'Fin du test de la contre-vérification 12d' });
        assert.equal(r.ok, true, JSON.stringify(r));
    }
}
