/**
 * Lot 12c — catalogue de la partenaire : lectures serveur (rôle de service, partenaire de la session) et écritures des
 * zones de livraison et des suppléments par les fonctions en base (order_delivery_zone_set / _remove / _reorder,
 * product_option_set / _remove). Aucun montant n'est calculé ici : prix, frais et minimums sont lus en base, les refus
 * viennent des fonctions (déjà en français simple).
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
import { PublicError } from '@/lib/api/public-error';
import { ProductService, catalogRefusal, type Product } from '@/lib/products/product.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CatalogOption { id: string; name: string; price: number; isActive: boolean; sortOrder: number }
export interface CatalogZone { id: string; name: string; fee: number; minOrder: number; isActive: boolean; sortOrder: number }
export interface CatalogVenue {
    id: string;
    name: string;
    kind: string;
    city: string | null;
    photo: string | null;
    validated: boolean;
    active: boolean;
    ordersOpen: boolean;
    modes: string[];
    depositAllowed: boolean;
    depositPercent: number | null;
    payOnHandover: boolean;
    prepMinutes: number | null;
    zones: CatalogZone[];
    tables: Array<{ id: string; number: string; capacity: number }>;
}
export interface CatalogProduct {
    id: string;
    venueId: string | null;
    categoryId: string | null;
    name: string;
    description: string | null;
    price: number;
    status: Product['status'];
    images: string[];
    isDailySpecial: boolean;
    stockManaged: boolean;
    stock: number | null;
    isRegulated: boolean;
    regulatedKind: 'ALCOOL' | 'TABAC' | null;
    /** Décision de l'administration : true = refusé à la vente (réglementé), false = autorisé, null = pas encore vérifié. */
    adminDecision: boolean | null;
    underReview: boolean;
    reviewWords: string[];
    reviewRequestedAt: string | null;
    portionsToday: { portions: number; sold: number } | null;
    options: CatalogOption[];
    updatedAt: string;
}
export interface CatalogReply {
    partnerStatus: string | null;
    venues: CatalogVenue[];
    categories: Array<{ id: string; name: string }>;
    products: CatalogProduct[];
    defaults: { depositPercent: number; prepMinutes: number };
}

type Row = Record<string, unknown>;
const num = (v: unknown): number => Number(v ?? 0);
const optNum = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/** Jour de Dakar (UTC toute l'année), comme les portions du plat du jour en base. */
function dakarToday(): string {
    return new Date().toISOString().slice(0, 10);
}

function toOption(o: Row): CatalogOption {
    return { id: String(o.id), name: String(o.name), price: num(o.price_delta ?? o.price), isActive: o.is_active !== false, sortOrder: num(o.sort_order) };
}

function toZone(z: Row): CatalogZone {
    return { id: String(z.id), name: String(z.name), fee: num(z.fee), minOrder: num(z.min_order), isActive: z.is_active !== false, sortOrder: num(z.sort_order) };
}

function toProduct(p: Row, options: Row[], portions: Row | undefined): CatalogProduct {
    return {
        id: String(p.id),
        venueId: (p.venue_id as string | null) ?? null,
        categoryId: (p.category_id as string | null) ?? null,
        name: String(p.name),
        description: (p.description as string | null) ?? null,
        price: num(p.price),
        status: p.status as Product['status'],
        images: Array.isArray(p.images) ? (p.images as string[]) : [],
        isDailySpecial: p.is_daily_special === true,
        stockManaged: p.is_stock_managed === true,
        stock: optNum(p.stock_quantity),
        isRegulated: p.is_regulated === true,
        regulatedKind: (p.regulated_kind as 'ALCOOL' | 'TABAC' | null) ?? null,
        adminDecision: typeof p.regulated_admin === 'boolean' ? p.regulated_admin : null,
        underReview: p.review_state === 'A_VERIFIER',
        reviewWords: Array.isArray(p.review_words) ? (p.review_words as string[]) : [],
        reviewRequestedAt: (p.review_requested_at as string | null) ?? null,
        portionsToday: portions ? { portions: num(portions.portions), sold: num(portions.sold) } : null,
        options: options.map(toOption).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
        updatedAt: String(p.updated_at),
    };
}

async function partnerOf(userId: string): Promise<{ id: string; status: string | null }> {
    const { data, error } = await getServiceRoleClient().from('partners').select('id, status').eq('user_id', userId)
        .order('created_at').limit(1).maybeSingle();
    if (error) throw new Error(`fiche partenaire de ${userId} illisible : ${error.message}`);
    if (!data) throw new PublicError('Profil partenaire introuvable.', 'PARTNER_NOT_FOUND', 404);
    return { id: String(data.id), status: (data.status as string | null) ?? null };
}

/** Catalogue complet de la partenaire de la session : établissements (réglages de vente, zones, tables), catégories, produits non archivés. */
export async function readPartnerCatalog(userId: string): Promise<CatalogReply> {
    const supabase = getServiceRoleClient();
    const partner = await partnerOf(userId);
    const [venuesRes, categoriesRes, productsRes, settingsRes] = await Promise.all([
        supabase.from('venues')
            .select('id, name, kind, city, photos, validation_status, is_active, orders_open, order_modes, order_deposit_allowed, order_deposit_percent, order_pay_on_handover, order_prep_minutes, created_at')
            .eq('partner_id', partner.id).order('created_at'),
        supabase.from('product_categories').select('id, name, sort_order').eq('partner_id', partner.id).order('sort_order').order('name'),
        supabase.from('products').select('*').eq('partner_id', partner.id).is('archived_at', null).order('created_at', { ascending: false }).limit(500),
        supabase.from('platform_settings').select('key, value').in('key', ['orders.deposit_default_percent', 'orders.prep_minutes_default']),
    ]);
    for (const [label, res] of [['établissements', venuesRes], ['catégories', categoriesRes], ['produits', productsRes], ['réglages', settingsRes]] as const) {
        if (res.error) throw new Error(`catalogue (${label}) : ${res.error.message}`);
    }
    const venues = (venuesRes.data ?? []) as Row[];
    const products = (productsRes.data ?? []) as Row[];
    const venueIds = venues.map((v) => String(v.id));
    const productIds = products.map((p) => String(p.id));
    const [zonesRes, tablesRes, optionsRes, portionsRes] = await Promise.all([
        venueIds.length ? supabase.from('order_delivery_zones').select('id, venue_id, name, fee, min_order, is_active, sort_order')
            .in('venue_id', venueIds).is('archived_at', null).order('sort_order').order('name') : Promise.resolve({ data: [], error: null }),
        venueIds.length ? supabase.from('restaurant_tables').select('id, venue_id, table_number, capacity, is_active')
            .in('venue_id', venueIds).eq('is_active', true).order('table_number') : Promise.resolve({ data: [], error: null }),
        productIds.length ? supabase.from('product_options').select('id, product_id, name, price_delta, is_active, sort_order')
            .in('product_id', productIds) : Promise.resolve({ data: [], error: null }),
        productIds.length ? supabase.from('product_daily_portions').select('product_id, portions, sold')
            .in('product_id', productIds).eq('day', dakarToday()) : Promise.resolve({ data: [], error: null }),
    ]);
    for (const [label, res] of [['zones', zonesRes], ['tables', tablesRes], ['suppléments', optionsRes], ['portions', portionsRes]] as const) {
        if (res.error) throw new Error(`catalogue (${label}) : ${res.error.message}`);
    }
    const byKey = <T extends Row>(rows: T[], key: string): Map<string, T[]> => {
        const m = new Map<string, T[]>();
        for (const r of rows) {
            const k = String(r[key]);
            m.set(k, [...(m.get(k) ?? []), r]);
        }
        return m;
    };
    const zones = byKey((zonesRes.data ?? []) as Row[], 'venue_id');
    const tables = byKey((tablesRes.data ?? []) as Row[], 'venue_id');
    const options = byKey((optionsRes.data ?? []) as Row[], 'product_id');
    const portions = new Map(((portionsRes.data ?? []) as Row[]).map((r) => [String(r.product_id), r]));
    const setting = (key: string, fallback: number): number => {
        const row = ((settingsRes.data ?? []) as Row[]).find((r) => r.key === key);
        const v = (row?.value as { value?: unknown } | undefined)?.value;
        return typeof v === 'number' ? v : fallback;
    };
    return {
        partnerStatus: partner.status,
        venues: venues.map((v) => ({
            id: String(v.id),
            name: String(v.name),
            kind: String(v.kind),
            city: (v.city as string | null) ?? null,
            photo: Array.isArray(v.photos) && v.photos.length > 0 ? String(v.photos[0]) : null,
            validated: v.validation_status === 'VALIDEE',
            active: v.is_active !== false,
            ordersOpen: v.orders_open === true,
            modes: Array.isArray(v.order_modes) ? (v.order_modes as string[]) : [],
            depositAllowed: v.order_deposit_allowed === true,
            depositPercent: optNum(v.order_deposit_percent),
            payOnHandover: v.order_pay_on_handover === true,
            prepMinutes: optNum(v.order_prep_minutes),
            zones: (zones.get(String(v.id)) ?? []).map(toZone),
            tables: (tables.get(String(v.id)) ?? []).map((t) => ({ id: String(t.id), number: String(t.table_number), capacity: num(t.capacity) })),
        })),
        categories: ((categoriesRes.data ?? []) as Row[]).map((c) => ({ id: String(c.id), name: String(c.name) })),
        products: products.map((p) => toProduct(p, options.get(String(p.id)) ?? [], portions.get(String(p.id)))),
        defaults: { depositPercent: setting('orders.deposit_default_percent', 30), prepMinutes: setting('orders.prep_minutes_default', 30) },
    };
}

/** Un produit de la partenaire de la session, avec ses suppléments et ses portions du jour (404 sinon, archivé compris). */
export async function readPartnerProduct(userId: string, productId: string): Promise<CatalogProduct> {
    const product = await ProductService.getProductById(productId, userId);
    const supabase = getServiceRoleClient();
    const [optionsRes, portionsRes] = await Promise.all([
        supabase.from('product_options').select('id, product_id, name, price_delta, is_active, sort_order').eq('product_id', product.id),
        supabase.from('product_daily_portions').select('product_id, portions, sold').eq('product_id', product.id).eq('day', dakarToday()).maybeSingle(),
    ]);
    if (optionsRes.error) throw new Error(`suppléments du produit ${productId} : ${optionsRes.error.message}`);
    if (portionsRes.error) throw new Error(`portions du produit ${productId} : ${portionsRes.error.message}`);
    if (product.archived_at) throw new PublicError('Produit introuvable.', 'PRODUCT_NOT_FOUND', 404);
    return toProduct(product as unknown as Row, (optionsRes.data ?? []) as Row[], (portionsRes.data ?? undefined) as Row | undefined);
}

async function callCatalog(fn: string, p: Row, fallback: string): Promise<Row> {
    const { data, error } = await getServiceRoleClient().rpc(fn, { p });
    if (error) throw new Error(`${fn} : ${error.message}`);
    const r = (data ?? {}) as Row;
    if (r.ok !== true) throw catalogRefusal(r, fallback);
    return r;
}

const text = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const numberish = (v: unknown): number | string | null => (typeof v === 'number' || typeof v === 'string' ? v : null);

/** Zone de livraison (création si zoneId est vide) : seules les valeurs données changent. */
export async function saveDeliveryZone(userId: string, venueId: string, zoneId: string | null, body: Row): Promise<CatalogZone> {
    if (!UUID_RE.test(venueId) || (zoneId !== null && !UUID_RE.test(zoneId))) {
        throw new PublicError('Cette zone n’existe pas dans cet établissement.', 'ZONE_NOT_FOUND', 404);
    }
    const p: Row = { actor_id: userId, venue_id: venueId, zone_id: zoneId };
    if ('name' in body) p.name = text(body.name);
    if ('fee' in body) p.fee = numberish(body.fee);
    if ('minOrder' in body) p.min_order = numberish(body.minOrder);
    if (typeof body.isActive === 'boolean') p.is_active = body.isActive;
    const r = await callCatalog('order_delivery_zone_set', p, 'Zone non enregistrée.');
    return toZone(r.zone as Row);
}

export async function removeDeliveryZone(userId: string, zoneId: string): Promise<{ outcome: string; message: string }> {
    if (!UUID_RE.test(zoneId)) throw new PublicError('Cette zone n’existe pas dans vos établissements.', 'ZONE_NOT_FOUND', 404);
    const r = await callCatalog('order_delivery_zone_remove', { actor_id: userId, zone_id: zoneId }, 'Zone non retirée.');
    return { outcome: String(r.outcome), message: String(r.message ?? 'Zone retirée.') };
}

export async function reorderDeliveryZones(userId: string, venueId: string, zoneIds: unknown): Promise<string[]> {
    if (!UUID_RE.test(venueId)) throw new PublicError('Cet établissement n’existe pas ou n’est pas le vôtre.', 'VENUE_NOT_FOUND', 404);
    const ids = Array.isArray(zoneIds) ? zoneIds.filter((x): x is string => typeof x === 'string').slice(0, 60) : [];
    const r = await callCatalog('order_delivery_zones_reorder', { actor_id: userId, venue_id: venueId, zone_ids: ids }, 'Ordre non enregistré.');
    return (r.zone_ids as string[]) ?? [];
}

/** Supplément d'un produit (création si optionId est vide). */
export async function saveProductOption(userId: string, productId: string, optionId: string | null, body: Row): Promise<{ option: CatalogOption; reviewRequested: boolean }> {
    if (!UUID_RE.test(productId) || (optionId !== null && !UUID_RE.test(optionId))) {
        throw new PublicError('Ce supplément n’existe pas pour ce produit.', 'OPTION_NOT_FOUND', 404);
    }
    const p: Row = { actor_id: userId, product_id: productId, option_id: optionId };
    if ('name' in body) p.name = text(body.name);
    if ('price' in body) p.price = numberish(body.price);
    if (typeof body.isActive === 'boolean') p.is_active = body.isActive;
    if ('sortOrder' in body) p.sort_order = numberish(body.sortOrder);
    const r = await callCatalog('product_option_set', p, 'Supplément non enregistré.');
    return { option: toOption(r.option as Row), reviewRequested: r.review_requested === true };
}

export async function removeProductOption(userId: string, optionId: string): Promise<void> {
    if (!UUID_RE.test(optionId)) throw new PublicError('Ce supplément n’existe pas pour vos produits.', 'OPTION_NOT_FOUND', 404);
    await callCatalog('product_option_remove', { actor_id: userId, option_id: optionId }, 'Supplément non retiré.');
}
