/**
 * Lot 8 (contrat 15.5, T25, T26) — outils des parcours de bout en bout, partagés par la fumée (e2e/fumee.spec.ts), le projet
 * terrain (e2e/terrain.spec.ts) et la recette (e2e/recette.spec.ts). Extraits de ces fichiers sans changement de
 * comportement ; seul ajout : le numéro de paiement facultatif de buyThroughUi, celui du client de la fumée par défaut.
 */
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { fumeePayerPhone } from './accounts';
import { e2eConfig } from './env';
import { outboxByProviderIds, serviceClient, type OutboxLine, type SentSmsLine } from './service';

export function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Date et heure (Africa/Dakar = UTC+0) au format des champs date et time. */
export function dakarParts(d: Date): { date: string; time: string } {
    const iso = d.toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** Plus petit bloc qui contient le titre de l'événement et le bouton demandé (carte de la liste). */
export function cardOf(page: Page, title: string, action: RegExp): Locator {
    return page.locator('li, article, tr, section, div')
        .filter({ has: page.getByText(title, { exact: true }) })
        .filter({ has: page.getByRole('button', { name: action }) })
        .last();
}

/** Clic sur une action ; si une modale de confirmation s'ouvre, elle est confirmée (même libellé ou « Confirmer »). */
export async function actionWithConfirm(page: Page, scope: Locator, action: RegExp): Promise<void> {
    await scope.getByRole('button', { name: action }).click();
    const dialog = page.getByRole('dialog').or(page.getByRole('alertdialog'));
    if (await dialog.isVisible()) {
        await dialog.getByRole('button', { name: new RegExp(`${action.source}|confirmer`, 'i') }).last().click();
        await expect(dialog).toBeHidden();
    }
}

/** Indicateur de la page de pilotage : plus petit bloc du panneau qui porte le libellé et un nombre. */
export function kpi(panel: Locator, label: RegExp): Locator {
    return panel.locator('dl, li, article, section, div')
        .filter({ has: panel.page().getByText(label) })
        .filter({ hasText: /\d/ })
        .last();
}

export async function fakeServices(pathName: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
    const res = await fetch(`${e2eConfig().fakeServicesUrl}${pathName}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: Record<string, unknown>;
    try {
        json = text ? JSON.parse(text) as Record<string, unknown> : {};
    } catch (err) {
        throw new Error(`faux services ${pathName} : réponse illisible (${err instanceof Error ? err.message : String(err)}) : ${text.slice(0, 200)}`);
    }
    return { status: res.status, json };
}

// ── Fumée, lot 6 (contrat P3) : étapes 7 à 10 ──────────────────────────────

export interface FakeSms { ticket: string; msisdn: string; message: string; receivedAt: string }

/** SMS reçus par le faux MTarget pour ce numéro (200 derniers, plus récent d'abord). */
export async function fakeSmsTo(phone: string): Promise<FakeSms[]> {
    const digits = phone.replace(/\D/g, '');
    const res = await fetch(`${e2eConfig().fakeServicesUrl}/__test/sms?to=${digits}&limit=200`);
    const text = await res.text();
    if (!res.ok) throw new Error(`faux MTarget /__test/sms : HTTP ${res.status} ${text.slice(0, 200)}`);
    let body: { messages?: FakeSms[] };
    try {
        body = JSON.parse(text) as { messages?: FakeSms[] };
    } catch (err) {
        throw new Error(`faux MTarget /__test/sms : réponse illisible (${err instanceof Error ? err.message : String(err)}) : ${text.slice(0, 200)}`);
    }
    if (!Array.isArray(body.messages)) throw new Error(`faux MTarget /__test/sms : liste absente ${text.slice(0, 200)}`);
    return body.messages;
}

/** SMS arrivés depuis le repère (tickets connus avant l'étape), du plus ancien au plus récent. */
export function smsSince(all: FakeSms[], before: ReadonlySet<string>): FakeSms[] {
    return all.filter((m) => !before.has(m.ticket)).reverse();
}

/** Réglage notif.* entier lu dans platform_settings (valeur historisée du contrat I1). */
export async function notifSettingInt(key: string): Promise<number> {
    const { data, error } = await serviceClient().from('platform_settings').select('value').eq('key', key).maybeSingle();
    if (error) throw new Error(`réglage ${key} : ${error.message}`);
    const value = Number((data?.value as { value?: unknown } | null | undefined)?.value);
    if (!Number.isInteger(value)) throw new Error(`réglage ${key} illisible : ${JSON.stringify(data)}`);
    return value;
}

/** Heure de Dakar dans la plage de silence [start, end) (plage vide si start = end, à cheval sur minuit si start > end). */
export function inQuietHours(hour: number, start: number, end: number): boolean {
    if (start === end) return false;
    return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

/** Jour de Dakar (AAAA-MM-JJ, UTC+0) décalé de `offset` jours. */
export function dakarDayFrom(base: Date, offset: number): string {
    const d = new Date(base.getTime());
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
}

/** Données de rendu comme l'envoyeur (dispatcher.ts, renderData) : template_data complété, sans rien écraser. */
export function renderData(row: OutboxLine, event: Record<string, unknown>): Record<string, unknown> {
    const data: Record<string, unknown> = { ...(row.template_data ?? {}) };
    for (const [k, v] of Object.entries(event)) if (data[k] === undefined) data[k] = v;
    return data;
}

export function brief(rows: OutboxLine[]): string {
    return JSON.stringify(rows.map((r) => ({ type: r.type, channel: r.channel, status: r.status, reason: r.reason, user: r.recipient_user_id })));
}

/**
 * Achat par l'interface, comme à l'étape 4, depuis la page publique de l'événement ; renvoie tous les billets émis
 * (lot 7 : `quantity` billets de la catégorie, pour la fumée prolongée).
 */
export async function buyThroughUi(client: Page, eventId: string, category: string, quantity = 1, payerPhone = fumeePayerPhone()): Promise<string[]> {
    await client.goto(`/events/${eventId}`);
    for (let i = 0; i < quantity; i++) {
        await client.getByRole('button', { name: new RegExp(`ajouter un billet ${escapeRe(category)}`, 'i') }).click();
    }
    await client.getByRole('button', { name: /^acheter/i }).click();
    const dialog = client.getByRole('dialog').or(client.getByRole('alertdialog'));
    await expect(dialog).toBeVisible();
    // Radio masqué (sr-only) dans son libellé : check({ force: true }) le jugeait parfois hors de l'écran dans la
    // modale (run 66) ; le clic est envoyé à l'élément, puis la sélection est vérifiée.
    const wave = dialog.getByRole('radio', { name: /^wave/i });
    await wave.dispatchEvent('click');
    await expect(wave).toBeChecked();
    await dialog.getByLabel(/numéro/i).fill(payerPhone);
    await dialog.getByRole('button', { name: /payer|confirmer|continuer/i }).last().click();
    await client.waitForURL(/\/paiement\/[0-9a-f-]{36}/);
    const succeeded = client.waitForResponse(async (r) => {
        if (!/\/api\/payments\/[^/]+\/status/.test(r.url()) || !r.ok()) return false;
        const body = (await r.json()) as { status?: string; ticket_ids?: unknown };
        return body.status === 'SUCCESS' && Array.isArray(body.ticket_ids) && body.ticket_ids.length > 0;
    }, { timeout: 45_000 });
    const done = await fakeServices('/__test/samirpay/complete', { telephone: payerPhone });
    expect(done.status, `faux SamirPay : ${JSON.stringify(done.json)}`).toBe(200);
    expect(done.json.webhookStatus, `réponse du webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
    const status = (await (await succeeded).json()) as { ticket_ids: string[] };
    await expect(client.getByText('Paiement confirmé')).toBeVisible({ timeout: 45_000 });
    expect(status.ticket_ids.length, `billets émis par l’achat de ${quantity} billet(s)`).toBe(quantity);
    return status.ticket_ids;
}

// ── Fumée, lot 7 (D81, fumée prolongée) : étapes 8, 10 et 11 à 16 ───────────

export interface IdentifiedSms { sms: FakeSms; line: SentSmsLine | null }

/** SMS du faux MTarget identifiés par la boîte d'envoi (provider_message_id = ticket), imprimés [FUMEE-SMS]. */
export async function identifySms(label: string, received: FakeSms[], names: Record<string, string>): Promise<IdentifiedSms[]> {
    const lines = await outboxByProviderIds(received.map((m) => m.ticket));
    const byTicket = new Map(lines.map((l) => [l.provider_message_id, l]));
    const out = received.map((sms) => ({ sms, line: byTicket.get(sms.ticket) ?? null }));
    console.log(`[FUMEE-SMS] ${label} : ${out.length} SMS`);
    for (const { sms, line } of out) {
        console.log(line
            ? `[FUMEE-SMS]   ${line.type} · ${line.event_id ? names[line.event_id] ?? `événement ${line.event_id}` : 'sans événement'} · clé ${line.idempotency_key} · ${line.status} · ticket ${sms.ticket} · ${sms.receivedAt}`
            : `[FUMEE-SMS]   NON IDENTIFIÉ · ticket ${sms.ticket} · ${sms.receivedAt} · « ${sms.message.slice(0, 80)} »`);
    }
    return out;
}

/** Lot hors ligne d'un billet lu dans IndexedDB (lib/tickets/offline-store.ts : base event-village-offline, magasin lots). */
export interface StoredLot { ticket_id: string; secret_version: number; prefix: string; step_seconds: number; digits: number; first_counter: number; count: number; codes: string }

export async function readStoredLots(page: Page, ticketId: string): Promise<StoredLot[]> {
    return page.evaluate(async (id) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const r = indexedDB.open('event-village-offline');
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error ?? new Error('ouverture de event-village-offline impossible'));
        });
        try {
            if (!db.objectStoreNames.contains('lots')) return [];
            return await new Promise<StoredLot[]>((resolve, reject) => {
                const q = db.transaction('lots', 'readonly').objectStore('lots').index('ticketId').getAll(id);
                q.onsuccess = () => resolve((q.result as Array<{ lot: StoredLot }>).map((r) => r.lot));
                q.onerror = () => reject(q.error ?? new Error('lecture du magasin lots impossible'));
            });
        } finally {
            db.close();
        }
    }, ticketId);
}

/** Payload du pas courant calculé depuis un lot (même règle que pickOfflineCode, heure du serveur local ≈ Date.now()). */
export function payloadFromLot(lot: StoredLot, at = Date.now()): { payload: string; counter: number } {
    const counter = Math.floor(at / (Number(lot.step_seconds) * 1000));
    const index = counter - Number(lot.first_counter);
    if (index < 0 || index >= Number(lot.count)) throw new Error(`pas ${counter} hors du lot du billet ${lot.ticket_id} (premier ${lot.first_counter}, ${lot.count} codes)`);
    const digits = Number(lot.digits);
    const code = lot.codes.substr(index * digits, digits);
    if (!/^\d+$/.test(code)) throw new Error(`code illisible dans le lot du billet ${lot.ticket_id} (pas ${counter})`);
    return { payload: `${lot.prefix}:${lot.ticket_id}:${code}`, counter };
}

export const OFFLINE_CACHE = 'ev-hors-ligne-lot7-1';

/** Cloche ouverte sur « Mes billets » ; renvoie le panneau (région « Notifications »). */
export async function openBell(client: Page): Promise<Locator> {
    await client.goto('/tickets');
    await client.getByRole('button', { name: /^notifications/i }).filter({ visible: true }).first().click();
    const panel = client.getByRole('region', { name: /^notifications$/i });
    await expect(panel).toBeVisible();
    return panel;
}

// ── Scanner : reprise de session (projet terrain, amendement A10) ──────────

/** Contrôle repris sans repasser par l'écran de choix : même événement, même mode ; caméra : « Reprendre le contrôle ». */
export async function expectResumed(page: Page, title: string, mode: 'camera' | 'manual', what: string): Promise<void> {
    await expect(page.getByRole('heading', { level: 1, name: title }), `${what} : même événement repris (barre d'état du scanner)`).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('heading', { level: 1, name: /^commencer le contr[ôo]le$/i }), `${what} : l'écran de choix n'est pas réaffiché`).toHaveCount(0);
    const pressed = page.getByRole('button', { name: mode === 'camera' ? /^caméra$/i : /^saisie manuelle$/i });
    await expect(pressed, `${what} : même mode (${mode === 'camera' ? 'caméra' : 'saisie manuelle'})`).toHaveAttribute('aria-pressed', 'true');
    if (mode === 'camera') {
        await expect(page.getByRole('button', { name: /^reprendre le contr[ôo]le$/i }), `${what} : écran « Reprendre le contrôle »`).toBeVisible();
    }
}
