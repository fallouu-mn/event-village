/**
 * Contre-vérification du lot 10b (salles : écrans et parcours complet) — aides communes aux suites tests/audit/cv10b-*.
 * Aucune aide ne corrige quoi que ce soit : elles montent des comptes et des salles, appellent les routes réelles de
 * l'application (gestionnaires importés, session par jeton) ou la REST (clé anon + jeton, jamais la clé de service pour
 * une attaque), et lisent la base LOCALE. Faux SamirPay et faux SMS : aucun appel réel.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
    api, dayFromNow, decideHall, newBuyer, newHall, newPartner, openHallsService, payConfirmed, platformSetting,
    reservation, reserveRpc, restAs, service, setPlatformSetting, show, type Buyer, type Reply, type Row, type TestPartner,
} from './cv10a-helpers';
import { newAdmin, type TestAdmin } from '../parcours/notif-helpers';
import { superadminId } from '../parcours/finance-helpers';

export type { Buyer, Reply, Row, TestAdmin, TestPartner };
export {
    api, dayFromNow, decideHall, newAdmin, newBuyer, newHall, newPartner, openHallsService, payConfirmed, platformSetting,
    reservation, reserveRpc, restAs, service, setPlatformSetting, show, superadminId,
};

/** Route réelle avec un segment [id] et, au besoin, une requête (?a=b). */
export function routeId(method: string, rel: string, id: string, token: string | null, body?: unknown, query = ''): Promise<Reply> {
    return api(method, rel, { token, params: { id }, path: `/api/${rel.replace('[id]', id)}${query}`, body });
}

/** Adresse d'une photo « déposée » (nom réencodé) dans le dossier des salles d'une partenaire. */
export function photoOf(partnerId: string): string {
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
    return `${base}/storage/v1/object/public/public-images/halls/${partnerId}/${Date.now()}_${randomBytes(4).toString('hex')}.webp`;
}

/** Statut de la fiche partenaire posé directement (état « fiche SUSPENDU, compte ACTIF » des gardes du lot 9 quinquies). */
export async function setFiche(partnerId: string, status: 'VALIDE' | 'SUSPENDU'): Promise<void> {
    const { error } = await service.from('partners').update({ status }).eq('id', partnerId);
    assert.equal(error, null, `fiche ${partnerId} → ${status} : ${error?.message}`);
}

/** Suspension officielle d'une partenaire (partner_status_set : fiche et compte SUSPENDU, sessions révoquées). */
export async function suspendPartner(partnerId: string, reason: string): Promise<Row> {
    const { data, error } = await service.rpc('partner_status_set', {
        p: { partner_id: partnerId, actor_id: await superadminId(), status: 'SUSPENDU', reason },
    });
    assert.equal(error, null, `partner_status_set : ${error?.message}`);
    return data as Row;
}

/** Lignes de la boîte d'envoi d'un destinataire pour un type. */
export async function outboxRows(userId: string, type: string): Promise<Row[]> {
    const { data, error } = await service.from('notification_outbox')
        .select('id, type, channel, status, due_at, sent_at, decision, template_data, idempotency_key')
        .eq('recipient_user_id', userId).eq('type', type);
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

export const channelsOf = (rows: Row[]): string[] => [...new Set(rows.map((r) => String(r.channel)))].sort();

/** Exécute `fn` avec des réglages posés, puis remet les valeurs d'origine (même en cas d'échec). */
export async function withSettings<T>(values: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
    const before: Record<string, unknown> = {};
    for (const k of Object.keys(values)) before[k] = await platformSetting(k);
    try {
        for (const [k, v] of Object.entries(values)) await setPlatformSetting(k, v, 'contre-vérification du lot 10b');
        return await fn();
    } finally {
        for (const [k, v] of Object.entries(before)) await setPlatformSetting(k, v, 'contre-vérification du lot 10b (remise)');
    }
}

/** Trace d'une attaque dans la sortie brute (lue au rapport). */
export function trace(tag: string, what: unknown): void {
    console.log(`[CV10B] ${tag} : ${typeof what === 'string' ? what : JSON.stringify(what)}`);
}
