/**
 * Lot 5.1 — test de fumée, clic par clic, sur l'application démarrée (next start) avec les faux
 * services locaux (contrat P, « Fumée ») :
 *  1. le partenaire crée un événement (début dans 2 h) puis le soumet ;
 *  2. le SUPERADMIN le valide ;
 *  3. le partenaire le publie ;
 *  4. un client l'achète : faux SamirPay, puis /__test/samirpay/complete déclenche le vrai webhook,
 *     et la page de suivi affiche le succès ;
 *  5. le partenaire propriétaire scanne le billet sur /partner/scan (caméra simulée à partir de
 *     l'image du QR dynamique du client ; repli E2E_SCAN_MODE=barcode-detector) : « Entrée validée » ;
 *  6. la page de pilotage montre 1 vendu et 1 entrée.
 * Comptes du seed de test (indépendants de la démonstration). Sélecteurs par rôle et libellé
 * accessibles, alignés sur le contrat du lot 5 : le test échoue tant que les écrans du lot ne sont
 * pas livrés (formulaire partagé, transitions, /admin/events, pilotage).
 *
 * Lot 6 (contrat P3, tâche 6.12) : fumée prolongée, étapes 7 à 10 après les 6 étapes ci-dessus, inchangées :
 *  7. second événement E2 du partenaire A, début à J+2 20:00 (Dakar) pour que J-1 et H-3 soient à venir,
 *     créé par les RPC (event_create, event_transition : soumission, validation par le SUPERADMIN,
 *     publication) avec le client service_role local (e2e/support/service.ts), puis acheté par le client
 *     dans l'interface (même parcours qu'à l'étape 4) ;
 *  8. horloge simulée (e2e/support/clock.ts) : planification à la veille, à l'heure réglée, puis envoyeur
 *     une minute plus tard, adaptateurs réels pointés sur les faux services → lignes REMINDER_J1 (IN_APP
 *     et SMS envoyés, PUSH et EMAIL écartés avec motif), texte J-1 exact une seule fois au faux MTarget,
 *     « Rappel : c'est demain » dans la cloche ; puis planification au début moins le délai réglé →
 *     lignes REMINDER_H3 en attente, rien d'envoyé ;
 *  9. annulation par le partenaire dans l'interface (modale existante) → REMINDER_H3 CANCELLED
 *     (EVENT_ANNULE), vraie route GET /api/cron/notifications-dispatch (Bearer CRON_SECRET, heure réelle)
 *     → avis d'annulation (EVENT_CANCELLED, indispensable donc hors plage de silence) au texte exact une
 *     seule fois, « Événement annulé » dans la cloche ;
 * 10. comptage par différence depuis l'étape 8 (numéro du client fixe) ; aucune ligne de E2 en SENDING.
 * Plages de silence : aucun réglage modifié. Le J-1 est envoyé à l'heure simulée de la veille (heure
 * réglée, 10 h par défaut), hors plage (vérifié avant l'envoi, échec explicite sinon) ; l'avis
 * d'annulation est indispensable (jamais soumis à la plage).
 *
 * Lot 7 (contrat 11.4, D81 ; commit fix(7.7)) — étapes 8 et 10 adaptées (signalé) :
 *  - 8 : avant le repère, la boîte d'envoi de E1 est vidée (envoyeur à l'heure réelle, onlyEventIds = E1 et tout
 *    autre événement qui garde une ligne SMS en attente pour le client, sauf E2) ; les SMS ainsi partis sont
 *    identifiés et imprimés ([FUMEE-SMS] avant le repère). Au lot 6, ces SMS arrivaient après le repère et
 *    restaient « non identifiés » (5 SMS reçus pour 2 attendus au run 76) ;
 *  - 10 : chaque SMS reçu depuis le repère est identifié par jointure notification_outbox.provider_message_id =
 *    ticket du faux MTarget (type, événement, clé d'idempotence, statut), imprimé [FUMEE-SMS], et la liste exacte
 *    est exigée : PURCHASE_CONFIRMED, REMINDER_J1, EVENT_CANCELLED et REFUND_PAID (remboursement automatique de
 *    l'achat à l'annulation) de E2, une fois chacun, tous SENT, aucun SMS
 *    sans ligne, aucune clé en double (un doublon serait un défaut). Les comptes du lot 6 (j1 1, h3 0, annulation 1)
 *    restent vérifiés.
 * Fumée prolongée (étapes 11 à 16, tâche 7.7 « achat, téléchargement des codes la veille, passage hors ligne, scan
 * accepté, transfert puis ancien code refusé ») :
 * 11. scripts/e2e/terrain-setup.ts : `access.scan_window_before_hours = 24` (remis dans un finally), événement E3 du
 *     partenaire A à ≈ 20 h de l'heure réelle, catégorie payante, publié, contrôleur A affecté ;
 * 12. le client achète 2 billets de E3 par l'interface (parcours de l'étape 4), puis ouvre /tickets dans un contexte
 *     où le service worker est autorisé : « Disponible hors ligne » sur les deux cartes ; lot du 2e billet lu dans
 *     IndexedDB (event-village-offline, magasin lots) ;
 * 13. hors ligne, /billet/hors-ligne?id=<billet 1> servi par le service worker, QR affiché, data-ev-qr-counter qui
 *     change au bout de ≈ 21 s RÉELLES (expect.poll, aucune horloge simulée), aucune requête en échec ni erreur de
 *     console depuis le passage hors ligne ;
 * 14. contrôleur A en ligne (autre contexte, sonde du projet terrain) : payload lu sur la page hors ligne du client
 *     → « valid » ;
 * 15. transfert du billet 2 vers le second client par l'interface, acceptation par le destinataire (numéro marqué
 *     vérifié par terrain-setup.ts), puis code du pas courant calculé depuis l'ANCIEN lot (étape 12) → « qr_expired » ;
 * 16. caches du client : exactement « ev-hors-ligne-lot7-1 », aucune URL /api/ ni _rsc ; aucune réponse /api/
 *     servie par le service worker ; hors ligne, fetch de /api/tickets/<id>/offline-codes rejeté ; réglage remis.
 *
 * Lot 8 (contrat 15.3, T25) : test de plus, après la fumée : pages et routes de développement en 404 sur `next start`,
 * avec et sans session. En dernier parce que le fichier est en mode « serial » : rouge jusqu'à fix(8.1s), il ne doit pas
 * empêcher la fumée. L'extraction des outils vers support/parcours.ts est faite à la vague F, avec la recette.
 */
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { test, expect, openRoleContext, prepareContext, projectContextOptions } from './support/fixtures';
import { fumeePayerPhone } from './support/accounts';
import { APP_URL, e2eConfig } from './support/env';
import { cameraDiagSnapshot, describeCameraScan, fakeScanMode, installCameraDiagnostics, installFakeCamera } from './support/fake-camera';
import { PageGuard } from './support/network';
import { posterHtml, POSTER_SIZE } from './support/poster';
import type { SimulatedClock } from './support/clock';
import {
    createPublishedEvent, eventImageUrl, outboxByProviderIds, outboxOfEvent, pendingSmsEventsOf, sendingOfEvent, serviceClient, ticketNumbers,
    userIdByEmail, type OutboxLine, type SentSmsLine,
} from './support/service';
import {
    installScanProbe, openScanner, prepareTerrainEvent, presentPayload, restoreTerrainSetting, verifyHolderPhone, type TerrainEvent,
} from './support/terrain';
import { FIXTURE_USERS } from '../tests/helpers/fixture-data';

test.describe.configure({ mode: 'serial' });
test.setTimeout(20 * 60_000);

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Date et heure (Africa/Dakar = UTC+0) au format des champs date et time. */
function dakarParts(d: Date): { date: string; time: string } {
    const iso = d.toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** Plus petit bloc qui contient le titre de l'événement et le bouton demandé (carte de la liste). */
function cardOf(page: Page, title: string, action: RegExp): Locator {
    return page.locator('li, article, tr, section, div')
        .filter({ has: page.getByText(title, { exact: true }) })
        .filter({ has: page.getByRole('button', { name: action }) })
        .last();
}

/** Clic sur une action ; si une modale de confirmation s'ouvre, elle est confirmée (même libellé ou « Confirmer »). */
async function actionWithConfirm(page: Page, scope: Locator, action: RegExp): Promise<void> {
    await scope.getByRole('button', { name: action }).click();
    const dialog = page.getByRole('dialog').or(page.getByRole('alertdialog'));
    if (await dialog.isVisible()) {
        await dialog.getByRole('button', { name: new RegExp(`${action.source}|confirmer`, 'i') }).last().click();
        await expect(dialog).toBeHidden();
    }
}

/** Indicateur de la page de pilotage : plus petit bloc du panneau qui porte le libellé et un nombre. */
function kpi(panel: Locator, label: RegExp): Locator {
    return panel.locator('dl, li, article, section, div')
        .filter({ has: panel.page().getByText(label) })
        .filter({ hasText: /\d/ })
        .last();
}

async function fakeServices(pathName: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
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

// ── Lot 6 (contrat P3) : outils des étapes 7 à 10 ──────────────────────────

interface FakeSms { ticket: string; msisdn: string; message: string; receivedAt: string }

/** SMS reçus par le faux MTarget pour ce numéro (200 derniers, plus récent d'abord). */
async function fakeSmsTo(phone: string): Promise<FakeSms[]> {
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
function smsSince(all: FakeSms[], before: ReadonlySet<string>): FakeSms[] {
    return all.filter((m) => !before.has(m.ticket)).reverse();
}

/** Réglage notif.* entier lu dans platform_settings (valeur historisée du contrat I1). */
async function notifSettingInt(key: string): Promise<number> {
    const { data, error } = await serviceClient().from('platform_settings').select('value').eq('key', key).maybeSingle();
    if (error) throw new Error(`réglage ${key} : ${error.message}`);
    const value = Number((data?.value as { value?: unknown } | null | undefined)?.value);
    if (!Number.isInteger(value)) throw new Error(`réglage ${key} illisible : ${JSON.stringify(data)}`);
    return value;
}

/** Heure de Dakar dans la plage de silence [start, end) (plage vide si start = end, à cheval sur minuit si start > end). */
function inQuietHours(hour: number, start: number, end: number): boolean {
    if (start === end) return false;
    return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

/** Jour de Dakar (AAAA-MM-JJ, UTC+0) décalé de `offset` jours. */
function dakarDayFrom(base: Date, offset: number): string {
    const d = new Date(base.getTime());
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
}

/** Données de rendu comme l'envoyeur (dispatcher.ts, renderData) : template_data complété, sans rien écraser. */
function renderData(row: OutboxLine, event: Record<string, unknown>): Record<string, unknown> {
    const data: Record<string, unknown> = { ...(row.template_data ?? {}) };
    for (const [k, v] of Object.entries(event)) if (data[k] === undefined) data[k] = v;
    return data;
}

function brief(rows: OutboxLine[]): string {
    return JSON.stringify(rows.map((r) => ({ type: r.type, channel: r.channel, status: r.status, reason: r.reason, user: r.recipient_user_id })));
}

/**
 * Achat par l'interface, comme à l'étape 4, depuis la page publique de l'événement ; renvoie tous les billets émis
 * (lot 7 : `quantity` billets de la catégorie, pour la fumée prolongée).
 */
async function buyThroughUi(client: Page, eventId: string, category: string, quantity = 1): Promise<string[]> {
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
    await dialog.getByLabel(/numéro/i).fill(fumeePayerPhone());
    await dialog.getByRole('button', { name: /payer|confirmer|continuer/i }).last().click();
    await client.waitForURL(/\/paiement\/[0-9a-f-]{36}/);
    const succeeded = client.waitForResponse(async (r) => {
        if (!/\/api\/payments\/[^/]+\/status/.test(r.url()) || !r.ok()) return false;
        const body = (await r.json()) as { status?: string; ticket_ids?: unknown };
        return body.status === 'SUCCESS' && Array.isArray(body.ticket_ids) && body.ticket_ids.length > 0;
    }, { timeout: 45_000 });
    const done = await fakeServices('/__test/samirpay/complete', { telephone: fumeePayerPhone() });
    expect(done.status, `faux SamirPay : ${JSON.stringify(done.json)}`).toBe(200);
    expect(done.json.webhookStatus, `réponse du webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
    const status = (await (await succeeded).json()) as { ticket_ids: string[] };
    await expect(client.getByText('Paiement confirmé')).toBeVisible({ timeout: 45_000 });
    expect(status.ticket_ids.length, `billets émis par l’achat de ${quantity} billet(s)`).toBe(quantity);
    return status.ticket_ids;
}

// ── Lot 7 (D81, fumée prolongée) : outils des étapes 8, 10 et 11 à 16 ───────

interface IdentifiedSms { sms: FakeSms; line: SentSmsLine | null }

/** SMS du faux MTarget identifiés par la boîte d'envoi (provider_message_id = ticket), imprimés [FUMEE-SMS]. */
async function identifySms(label: string, received: FakeSms[], names: Record<string, string>): Promise<IdentifiedSms[]> {
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
interface StoredLot { ticket_id: string; secret_version: number; prefix: string; step_seconds: number; digits: number; first_counter: number; count: number; codes: string }

async function readStoredLots(page: Page, ticketId: string): Promise<StoredLot[]> {
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
function payloadFromLot(lot: StoredLot, at = Date.now()): { payload: string; counter: number } {
    const counter = Math.floor(at / (Number(lot.step_seconds) * 1000));
    const index = counter - Number(lot.first_counter);
    if (index < 0 || index >= Number(lot.count)) throw new Error(`pas ${counter} hors du lot du billet ${lot.ticket_id} (premier ${lot.first_counter}, ${lot.count} codes)`);
    const digits = Number(lot.digits);
    const code = lot.codes.substr(index * digits, digits);
    if (!/^\d+$/.test(code)) throw new Error(`code illisible dans le lot du billet ${lot.ticket_id} (pas ${counter})`);
    return { payload: `${lot.prefix}:${lot.ticket_id}:${code}`, counter };
}

const OFFLINE_CACHE = 'ev-hors-ligne-lot7-1';

/** Cloche ouverte sur « Mes billets » ; renvoie le panneau (région « Notifications »). */
async function openBell(client: Page): Promise<Locator> {
    await client.goto('/tickets');
    await client.getByRole('button', { name: /^notifications/i }).filter({ visible: true }).first().click();
    const panel = client.getByRole('region', { name: /^notifications$/i });
    await expect(panel).toBeVisible();
    return panel;
}

test('fumée : créer, soumettre, valider, publier, acheter, scanner, piloter', async ({ browser }, testInfo) => {
    const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '.');
    const title = `Fumée — Concert des Parcelles ${stamp}`;
    const category = 'Entrée générale';
    const start = new Date(Date.now() + 2 * 3600_000);
    start.setUTCSeconds(0, 0);
    start.setUTCMinutes(Math.ceil(start.getUTCMinutes() / 5) * 5);
    const end = new Date(start.getTime() + 4 * 3600_000);
    const s = dakarParts(start);
    const e = dakarParts(end);
    let eventId = '';
    let ticketId = '';

    const contexts: BrowserContext[] = [];
    const guards: Array<{ role: string; guard: PageGuard }> = [];
    type FumeeRole = 'fumee-organisateur' | 'fumee-superadmin' | 'fumee-client' | 'fumee-client-bis' | 'fumee-controleur';
    async function pageAs(role: FumeeRole, withCamera = false, opts: { serviceWorkers?: 'allow'; scanProbe?: boolean } = {}): Promise<Page> {
        const context = await openRoleContext(browser, testInfo, role, role === 'fumee-controleur' ? 'sombre' : 'clair',
            opts.serviceWorkers ? { serviceWorkers: opts.serviceWorkers } : {});
        if (withCamera) {
            await context.addInitScript(installFakeCamera, { mode: fakeScanMode() });
            await context.addInitScript(installCameraDiagnostics);
        }
        if (opts.scanProbe) await context.addInitScript(installScanProbe);
        contexts.push(context);
        const page = await context.newPage();
        guards.push({ role, guard: new PageGuard(page) });
        return page;
    }
    let e3: TerrainEvent | null = null;

    try {
        const partner = await pageAs('fumee-organisateur', true);
        // Diagnostic de l'étape 5 (run 80) : messages du scanner (lectures écartées, envois, caméra)
        const scanConsole: string[] = [];
        partner.on('console', (msg) => {
            const text = msg.text();
            if (/^\[(camera|partner\/scan|scan)\]/.test(text)) scanConsole.push(`${msg.type()} ${text.slice(0, 200)}`);
        });

        await test.step('1. le partenaire crée l’événement (début dans 2 h)', async () => {
            await partner.goto('/partner/events/new');
            await partner.getByLabel(/^titre/i).fill(title);
            await partner.getByRole('radio', { name: /concerts/i }).or(partner.getByRole('button', { name: /^concerts/i })).first().click();
            await partner.getByLabel(/^description/i).fill('Concert de fumée : parcours complet de la création au contrôle d’entrée. Données fictives.');
            await partner.getByLabel(/date de début/i).fill(s.date);
            await partner.getByLabel(/heure de début/i).fill(s.time);
            await partner.getByLabel(/date de fin/i).fill(e.date);
            await partner.getByLabel(/heure de fin/i).fill(e.time);
            await partner.getByLabel(/^lieu/i).fill('Esplanade des Parcelles Assainies');
            await partner.getByLabel(/^ville/i).fill('Dakar');
            await partner.getByLabel(/capacité/i).fill('100');

            const posterPage = await partner.context().newPage();
            await posterPage.setViewportSize(POSTER_SIZE);
            await posterPage.setContent(posterHtml({
                title: 'Concert des Parcelles', kicker: 'Fumée', dateLabel: `${s.date} · ${s.time}`, venue: 'Esplanade des Parcelles Assainies',
                city: 'Dakar', organizer: 'Organisateur de test', palette: 'terre', motif: 'soleil',
            }));
            const poster = await posterPage.screenshot({ type: 'png' });
            await posterPage.close();
            const upload = partner.waitForResponse((r) => r.url().includes('/api/partner/upload') && r.request().method() === 'POST');
            await partner.getByLabel(/affiche/i).setInputFiles({ name: 'affiche-fumee.png', mimeType: 'image/png', buffer: poster });
            expect((await upload).ok(), 'téléversement de l’affiche').toBe(true);

            for (let i = 0; i < 6 && !(await partner.getByRole('heading', { name: /billetterie/i }).isVisible()); i++) {
                await partner.getByRole('button', { name: /^suivant/i }).click();
            }
            await expect(partner.getByRole('heading', { name: /billetterie/i })).toBeVisible();
            await partner.getByRole('button', { name: /ajouter une catégorie/i }).click();
            await partner.getByLabel(/nom de la catégorie/i).fill(category);
            await partner.getByLabel(/^prix/i).fill('5000');
            await partner.getByLabel(/quantité|quota|nombre de places/i).fill('50');
            await partner.getByRole('button', { name: /^enregistrer/i }).click();
            await partner.waitForURL(/\/partner\/events(\?|$)/);
            await expect(partner.getByText(title, { exact: true })).toBeVisible();
        });

        await test.step('1 bis. le partenaire soumet l’événement', async () => {
            const card = cardOf(partner, title, /^soumettre/i);
            await actionWithConfirm(partner, card, /^soumettre/i);
            await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(title, { exact: true }) }).last())
                .toContainText(/en attente de validation/i);
        });

        await test.step('2. le SUPERADMIN valide l’événement', async () => {
            const admin = await pageAs('fumee-superadmin');
            // Diagnostic (run 50 : fiche restée en « En attente » après une validation réussie) : chaque
            // réponse de la fiche et de la transition est écrite dans e2e.log.
            admin.on('response', async (res) => {
                const url = new URL(res.url());
                if (!/^\/api\/admin\/events\/[0-9a-f-]{36}(\/transition)?$/.test(url.pathname)) return;
                const body = (await res.json().catch(() => null)) as { actions?: { status?: string }; to?: string; code?: string } | null;
                console.log(`[e2e][fiche admin] ${res.request().method()} ${url.pathname} → ${res.status()} statut=${body?.actions?.status ?? body?.to ?? '—'} code=${body?.code ?? '—'}`);
            });
            admin.on('console', (msg) => { if (msg.type() === 'error') console.log(`[e2e][fiche admin][console] ${msg.text()}`); });
            await admin.goto('/admin/events?status=EN_ATTENTE');
            await admin.getByRole('link', { name: new RegExp(escapeRe(title)) }).click();
            await admin.waitForURL(/\/admin\/events\/[0-9a-f-]{36}/);
            await actionWithConfirm(admin, admin.locator('main'), /^valider/i);
            await expect(admin.getByText(/^validé$/i).first()).toBeVisible();
        });

        await test.step('3. le partenaire publie l’événement', async () => {
            await partner.goto('/partner/events');
            const card = cardOf(partner, title, /^publier/i);
            await actionWithConfirm(partner, card, /^publier/i);
            await expect(partner.locator('li, article, tr, section, div').filter({ has: partner.getByText(title, { exact: true }) }).last())
                .toContainText(/publié/i);
        });

        const client = await pageAs('fumee-client');
        await test.step('4. le client achète un billet (faux SamirPay, vrai webhook)', async () => {
            await client.goto('/explore');
            await client.getByRole('link', { name: new RegExp(escapeRe(title)) }).first().click();
            await client.waitForURL(/\/events\/[0-9a-f-]{36}/);
            eventId = new URL(client.url()).pathname.split('/').pop() ?? '';
            await client.getByRole('button', { name: new RegExp(`ajouter un billet ${escapeRe(category)}`, 'i') }).click();
            await client.getByRole('button', { name: /^acheter/i }).click();
            const dialog = client.getByRole('dialog').or(client.getByRole('alertdialog'));
            await expect(dialog).toBeVisible();
            // Radio masqué (sr-only) dans son libellé : check({ force: true }) le jugeait parfois hors de l'écran dans la
            // modale (runs 66 et 92) ; le clic est envoyé à l'élément, puis la sélection est vérifiée.
            const wave = dialog.getByRole('radio', { name: /^wave/i });
            await wave.dispatchEvent('click');
            await expect(wave).toBeChecked();
            await dialog.getByLabel(/numéro/i).fill(fumeePayerPhone());
            await dialog.getByRole('button', { name: /payer|confirmer|continuer/i }).last().click();
            await client.waitForURL(/\/paiement\/[0-9a-f-]{36}/);
            const succeeded = client.waitForResponse(async (r) => {
                if (!/\/api\/payments\/[^/]+\/status/.test(r.url()) || !r.ok()) return false;
                const body = (await r.json()) as { status?: string; ticket_ids?: unknown };
                return body.status === 'SUCCESS' && Array.isArray(body.ticket_ids) && body.ticket_ids.length > 0;
            }, { timeout: 45_000 });
            const done = await fakeServices('/__test/samirpay/complete', { telephone: fumeePayerPhone() });
            expect(done.status, `faux SamirPay : ${JSON.stringify(done.json)}`).toBe(200);
            expect(done.json.webhookStatus, `réponse du webhook réel : ${JSON.stringify(done.json)}`).toBe(200);
            const status = (await (await succeeded).json()) as { ticket_ids: string[] };
            ticketId = status.ticket_ids[0];
            await expect(client.getByText('Paiement confirmé')).toBeVisible({ timeout: 45_000 });
        });

        await test.step('5. le partenaire propriétaire scanne le billet (caméra simulée)', async () => {
            await partner.goto('/partner/scan');
            const select = partner.getByLabel('Événement contrôlé');
            const value = await select.locator('option', { hasText: title }).getAttribute('value');
            expect(value, 'événement publié proposé au scan').toBeTruthy();
            await select.selectOption(value as string);
            const cameraMode = partner.getByRole('button', { name: /^caméra$/i });
            if ((await cameraMode.getAttribute('aria-pressed')) !== 'true') await cameraMode.click();

            expect(ticketId, 'billet émis, lu dans la réponse de statut du paiement').toMatch(/^[0-9a-f-]{36}$/);
            const liveCode = client.waitForResponse((r) => r.url().includes(`/api/tickets/${ticketId}/live-code`) && r.ok());
            await client.goto('/tickets');
            const payload = String(((await (await liveCode).json()) as { payload?: string }).payload ?? '');
            const ticketCard = client.locator('li, article, section, div')
                .filter({ has: client.getByText(title) })
                .filter({ has: client.getByRole('img', { name: /QR d.entrée dynamique/i }) })
                .last();
            const qr = ticketCard.getByRole('img', { name: /QR d.entrée dynamique/i });
            await expect(qr).toBeVisible();
            const png = await qr.screenshot();
            const before = await cameraDiagSnapshot(partner);
            await partner.evaluate(async ({ dataUrl, p }) => {
                const cam = (window as unknown as { __evFakeCamera?: { show: (d: string) => Promise<void>; setPayload: (x: string) => void } }).__evFakeCamera;
                if (!cam) throw new Error('caméra simulée absente de la page');
                cam.setPayload(p);
                await cam.show(dataUrl);
            }, { dataUrl: `data:image/png;base64,${png.toString('base64')}`, p: payload });
            try {
                await expect(partner.getByText('Entrée validée').first()).toBeVisible({ timeout: 40_000 });
            } catch (err) {
                // Run 80 : QR présenté, aucun résultat. Le diagnostic dit si la boucle tournait (images analysées),
                // si une lecture est partie (POST) et dans quel état était l'écran ; QR présenté et image vidéo joints.
                await testInfo.attach('qr-presente.png', { body: png, contentType: 'image/png' });
                const detail = await describeCameraScan(partner, before, scanConsole, testInfo)
                    .catch((e: unknown) => `diagnostic caméra impossible : ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
                console.log(`[e2e][fumée] étape 5, payload attendu « ${payload} » ; ${detail}`);
                throw new Error(`${err instanceof Error ? err.message : String(err)}\n${detail}`);
            }
        });

        await test.step('6. la page de pilotage montre 1 vendu et 1 entrée', async () => {
            expect(eventId, 'identifiant de l’événement lu sur la page publique').toMatch(/^[0-9a-f-]{36}$/);
            await partner.goto(`/partner/events/${eventId}`);
            const apercu = partner.getByRole('tab', { name: /^aperçu/i });
            if ((await apercu.getAttribute('aria-selected')) !== 'true') await apercu.click();
            const panel = partner.getByRole('tabpanel');
            await expect(kpi(panel, /billets vendus/i)).toContainText(/(^|\D)1(\D|$)/);
            await expect(kpi(panel, /^entrées/i)).toContainText(/(^|\D)1(\D|$)/);
        });

        // ── Lot 6 (contrat P3) : étapes 7 à 10 ──────────────────────────────
        const clientPhone = FIXTURE_USERS.CLIENT.phone;
        const e2Title = `Fumée — Rappels des Parcelles ${stamp}`;
        const e2Category = 'Entrée générale';
        const e2Day = dakarDayFrom(new Date(), 2);
        const e2StartAt = new Date(`${e2Day}T20:00:00.000Z`);
        const e2Event: Record<string, unknown> = {
            event_id: '', title: e2Title, start_at: e2StartAt.toISOString(), location: 'Esplanade des Parcelles Assainies', city: 'Dakar',
        };
        let e2Id = '';
        let clientUserId = '';
        let clock: SimulatedClock | null = null;
        let smsMark = new Set<string>();
        let expectedJ1 = '';
        let expectedH3 = '';
        let expectedCancel = '';

        await test.step('7. second événement à J+2 20:00 (RPC du partenaire A), acheté par le client dans l’interface', async () => {
            expect(eventId, 'événement de l’étape 1 (affiche réutilisée)').toMatch(/^[0-9a-f-]{36}$/);
            clientUserId = await userIdByEmail(FIXTURE_USERS.CLIENT.email);
            const partnerUserId = await userIdByEmail(FIXTURE_USERS.PARTNER_A.email);
            const superadminId = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
            e2Id = await createPublishedEvent({
                partnerUserId,
                superadminId,
                title: e2Title,
                description: 'Second concert de fumée : rappels J-1 et H-3 par horloge simulée, puis annulation. Données fictives.',
                startDate: e2Day, startTime: '20:00:00', endDate: e2Day, endTime: '23:00:00',
                location: String(e2Event.location), city: String(e2Event.city), capacity: 100,
                imageUrl: await eventImageUrl(eventId),
                category: { name: e2Category, price: 5000, total: 50 },
            });
            e2Event.event_id = e2Id;
            const [ticket] = await buyThroughUi(client, e2Id, e2Category);
            expect(ticket, 'billet de E2, lu dans la réponse de statut du paiement').toMatch(/^[0-9a-f-]{36}$/);
        });

        await test.step('8. rappels J-1 puis H-3 par horloge simulée : boîte d’envoi, faux SMS, cloche', async () => {
            const { simulatedClock } = await import('./support/clock');
            const c = await simulatedClock();
            clock = c;
            const how = c.mode === 'processus' ? 'modules du dépôt importés dans le processus Playwright' : `repli scripts/e2e/clock-run.ts (${c.fallbackReason})`;
            testInfo.annotations.push({ type: 'horloge simulée', description: how });
            console.log(`[e2e][fumée] horloge simulée : ${how}`);

            const j1Hour = await notifSettingInt('notif.reminder_j1_hour');
            const h3Hours = await notifSettingInt('notif.reminder_h3_hours');
            const quietStart = await notifSettingInt('notif.sms_quiet_start');
            const quietEnd = await notifSettingInt('notif.sms_quiet_end');
            if (inQuietHours(j1Hour, quietStart, quietEnd)) {
                throw new Error(`rappel J-1 à ${j1Hour} h dans la plage de silence ${quietStart} h - ${quietEnd} h : la fumée ne modifie pas les réglages (contrat P3), relevez notif.reminder_j1_hour`);
            }
            // Lot 7 (D81) : boîte d'E1 vidée AVANT le repère (et toute autre ligne SMS en attente du client, hors E2),
            // à l'heure réelle ; les SMS partis sont identifiés, ils ne se mêlent plus au décompte de l'étape 10
            const drainEvents = Array.from(new Set([eventId, ...(await pendingSmsEventsOf(clientUserId, clientPhone))])).filter((id) => id !== e2Id);
            const beforeDrain = new Set((await fakeSmsTo(clientPhone)).map((m) => m.ticket));
            const drainReport = await c.dispatch(new Date(), drainEvents);
            console.log(`[e2e][fumée] boîte vidée avant le repère (événements ${drainEvents.join(', ')}) : ${JSON.stringify(drainReport)}`);
            const drained = await identifySms('avant le repère (boîte de E1 vidée)', smsSince(await fakeSmsTo(clientPhone), beforeDrain), { [eventId]: 'E1', [e2Id]: 'E2' });
            expect(drained.filter((d) => d.line === null).map((d) => d.sms.ticket), 'SMS partis au vidage de la boîte de E1, tous identifiés').toEqual([]);
            smsMark = new Set((await fakeSmsTo(clientPhone)).map((m) => m.ticket));

            const veille = new Date(`${dakarDayFrom(e2StartAt, -1)}T${String(j1Hour).padStart(2, '0')}:00:30.000Z`);
            const scheduled = await c.schedule(veille, [e2Id]);
            console.log(`[e2e][fumée] planification à ${veille.toISOString()} : ${JSON.stringify(scheduled)}`);
            expect(scheduled.created.REMINDER_J1 ?? 0, `planification J-1 : ${JSON.stringify(scheduled)}`).toBeGreaterThan(0);
            const dispatched = await c.dispatch(new Date(veille.getTime() + 60_000), [e2Id]);
            console.log(`[e2e][fumée] envoyeur à ${new Date(veille.getTime() + 60_000).toISOString()} : ${JSON.stringify(dispatched)}`);

            const vapid = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
            const j1 = (await outboxOfEvent(e2Id, ['REMINDER_J1'])).filter((r) => r.recipient_user_id === clientUserId);
            expect(j1.map((r) => `${r.channel} ${r.status}${r.reason ? ` ${r.reason}` : ''}`).sort(), `lignes REMINDER_J1 du client : ${brief(j1)}`).toEqual([
                'EMAIL SKIPPED EMAIL_NOT_CONFIGURED',
                'IN_APP SENT',
                `PUSH SKIPPED ${vapid ? 'NO_PUSH_SUBSCRIPTION' : 'PUSH_NOT_CONFIGURED'}`,
                'SMS SENT',
            ]);
            const j1Sms = j1.find((r) => r.channel === 'SMS') as OutboxLine;
            expectedJ1 = await c.renderSms('REMINDER_J1', renderData(j1Sms, e2Event));
            const received = smsSince(await fakeSmsTo(clientPhone), smsMark);
            expect(received.filter((m) => m.message === expectedJ1).length,
                `texte J-1 exact une seule fois au faux MTarget (attendu « ${expectedJ1} ») ; reçus : ${JSON.stringify(received.map((m) => m.message))}`).toBe(1);
            const panel = await openBell(client);
            await expect(panel.getByText(/rappel : c.est demain/i).first()).toBeVisible();

            const h3At = new Date(e2StartAt.getTime() - h3Hours * 3600_000 + 30_000);
            const h3Scheduled = await c.schedule(h3At, [e2Id]);
            console.log(`[e2e][fumée] planification à ${h3At.toISOString()} : ${JSON.stringify(h3Scheduled)}`);
            expect(h3Scheduled.created.REMINDER_H3 ?? 0, `planification H-3 : ${JSON.stringify(h3Scheduled)}`).toBeGreaterThan(0);
            const h3 = (await outboxOfEvent(e2Id, ['REMINDER_H3'])).filter((r) => r.recipient_user_id === clientUserId);
            expect(h3.length, `lignes REMINDER_H3 du client : ${brief(h3)}`).toBeGreaterThan(0);
            expect(h3.filter((r) => r.status !== 'PENDING'), `REMINDER_H3 en attente, rien d’envoyé : ${brief(h3)}`).toEqual([]);
            const h3Sms = h3.find((r) => r.channel === 'SMS');
            expect(h3Sms, `ligne SMS du H-3 : ${brief(h3)}`).toBeTruthy();
            expectedH3 = await c.renderSms('REMINDER_H3', renderData(h3Sms as OutboxLine, e2Event));
        });

        await test.step('9. annulation par le partenaire : H-3 annulés, avis d’annulation par la vraie route de l’envoyeur', async () => {
            if (!clock) throw new Error('horloge simulée absente (étape 8 non aboutie)');
            const c: SimulatedClock = clock;
            const before = new Set((await fakeSmsTo(clientPhone)).map((m) => m.ticket));
            await partner.goto(`/partner/events/${e2Id}`);
            await partner.getByRole('button', { name: /annuler l[’']événement/i }).click();
            const dialog = partner.getByRole('dialog').or(partner.getByRole('alertdialog'));
            await expect(dialog).toBeVisible();
            await expect(dialog.getByText(/acheteurs à prévenir/i)).toBeVisible();
            await dialog.getByLabel(/^avis public aux participants/i).fill('Concert de fumée annulé : les billets payés en ligne sont remboursés automatiquement.');
            await dialog.getByLabel(/^motif interne/i).fill('Fumée de bout en bout du lot 6.');
            await dialog.getByLabel(/pour confirmer, saisissez le titre exact/i).fill(e2Title);
            const cancelled = partner.waitForResponse(
                (r) => new URL(r.url()).pathname === `/api/partner/events/${e2Id}/cancel` && r.request().method() === 'POST',
                { timeout: 60_000 });
            await dialog.getByRole('button', { name: /^confirmer l[’']annulation$/i }).click();
            const res = await cancelled;
            expect(res.status(), `annulation par le partenaire : ${(await res.text()).slice(0, 300)}`).toBe(200);
            await expect(dialog).toBeHidden();

            const h3 = await outboxOfEvent(e2Id, ['REMINDER_H3']);
            expect(h3.length, 'lignes REMINDER_H3 de E2').toBeGreaterThan(0);
            expect(h3.map((r) => `${r.status} ${r.reason ?? ''}`), `REMINDER_H3 annulés dans la transaction de l’annulation : ${brief(h3)}`)
                .toEqual(h3.map(() => 'CANCELLED EVENT_ANNULE'));

            const secret = process.env.CRON_SECRET;
            if (!secret) throw new Error(`CRON_SECRET absente de ${e2eConfig().envFile} : la vraie route de l’envoyeur est protégée`);
            // Même hôte que le contrôle de run-e2e.mjs : le serveur écoute sur 127.0.0.1 (localhost peut viser ::1)
            const cron = await fetch(`http://127.0.0.1:${new URL(APP_URL).port}/api/cron/notifications-dispatch`, {
                method: 'GET', headers: { authorization: `Bearer ${secret}` },
            });
            const cronText = await cron.text();
            console.log(`[e2e][fumée] GET /api/cron/notifications-dispatch → ${cron.status} ${cronText.slice(0, 300)}`);
            expect(cron.status, `route de l’envoyeur : ${cronText.slice(0, 300)}`).toBe(200);

            const cancel = (await outboxOfEvent(e2Id, ['EVENT_CANCELLED']))
                .filter((r) => r.recipient_user_id === clientUserId || r.recipient_phone === clientPhone);
            const cancelSms = cancel.filter((r) => r.channel === 'SMS');
            expect(cancelSms.map((r) => r.status), `EVENT_CANCELLED SMS du client : ${brief(cancel)}`).toEqual(['SENT']);
            expect(cancel.filter((r) => r.channel === 'IN_APP').map((r) => r.status), `EVENT_CANCELLED dans l’application : ${brief(cancel)}`).toEqual(['SENT']);
            expectedCancel = await c.renderSms('EVENT_CANCELLED', renderData(cancelSms[0], e2Event));
            const received = smsSince(await fakeSmsTo(clientPhone), before);
            const messages = JSON.stringify(received.map((m) => m.message));
            expect(received.filter((m) => m.message === expectedCancel).length,
                `avis d’annulation exact une seule fois (attendu « ${expectedCancel} ») ; reçus : ${messages}`).toBe(1);
            expect(received.filter((m) => m.message === expectedH3).length, `aucun H-3 envoyé après l’annulation ; reçus : ${messages}`).toBe(0);
            const panel = await openBell(client);
            await expect(panel.getByText(/événement annulé/i).first()).toBeVisible();
        });

        await test.step('10. comptage par différence depuis l’étape 8 ; aucune ligne de E2 en SENDING', async () => {
            const received = smsSince(await fakeSmsTo(clientPhone), smsMark);
            const counts = {
                j1: received.filter((m) => m.message === expectedJ1).length,
                h3: received.filter((m) => m.message === expectedH3).length,
                annulation: received.filter((m) => m.message === expectedCancel).length,
            };
            console.log(`[e2e][fumée] SMS du client depuis l’étape 8 : ${received.length} (${JSON.stringify(counts)})`);
            expect(counts, `SMS du client depuis l’étape 8 : ${JSON.stringify(received.map((m) => m.message))}`).toEqual({ j1: 1, h3: 0, annulation: 1 });
            // Lot 7 (D81) : liste exacte, par jointure provider_message_id = ticket du faux MTarget
            const identified = await identifySms('depuis le repère de l’étape 8', received, { [eventId]: 'E1', [e2Id]: 'E2' });
            expect(identified.filter((d) => d.line === null).map((d) => `${d.sms.ticket} « ${d.sms.message.slice(0, 60)} »`),
                'chaque SMS reçu depuis le repère a sa ligne dans la boîte d’envoi (provider_message_id)').toEqual([]);
            const lines = identified.flatMap((d) => (d.line ? [d.line] : []));
            expect(lines.map((l) => `${l.type} ${l.event_id === e2Id ? 'E2' : l.event_id ?? 'sans événement'}`).sort(),
                `SMS du client depuis le repère : ${JSON.stringify(lines.map((l) => ({ type: l.type, cle: l.idempotency_key })))}`)
                // REFUND_PAID E2 : remboursement automatique de l'achat E2 à l'annulation (event_cancel →
                // refund_request EVENT_CANCELLATION_REFUND, envoyé aussitôt par CashoutService.sendBatch ; avis mis en
                // file par le trigger des cashouts au passage à CONFIRME, clé REFUND_PAID:<cashout>). Déjà relevé au
                // lot 6 parmi les SMS non identifiés de la fumée (contrat du lot 7, dette : PURCHASE_CONFIRMED E2,
                // PURCHASE_CONFIRMED E1, REFUND_PAID E2) ; oublié dans la liste exacte jusqu'au run 77.
                // Unicité contrôlée juste après (aucune clé deux fois).
                .toEqual(['EVENT_CANCELLED E2', 'PURCHASE_CONFIRMED E2', 'REFUND_PAID E2', 'REMINDER_J1 E2']);
            const keys = lines.map((l) => `${l.type} ${l.idempotency_key}`);
            expect(keys.filter((k, i) => keys.indexOf(k) !== i), 'aucun SMS envoyé deux fois pour la même clé (doublon = défaut)').toEqual([]);
            expect(lines.filter((l) => l.status !== 'SENT').map((l) => `${l.type} ${l.status}`), 'lignes des SMS reçus au statut SENT').toEqual([]);
            const sending = await sendingOfEvent(e2Id);
            expect(sending, `lignes de E2 encore SENDING : ${brief(sending)}`).toEqual([]);
        });

        // ── Lot 7 (contrat 11.4) : étapes 11 à 16 ───────────────────────────
        const e3Category = 'Entrée générale';
        let e3Tickets: string[] = [];
        let e3Numbers: string[] = [];
        let oldLot: StoredLot | null = null;
        let swClient: Page | null = null;
        let controller: Page | null = null;
        const swApiResponses: string[] = [];

        await test.step('11. événement E3 à ≈ 20 h (partenaire A, catégorie payante), contrôleur A affecté, fenêtre de scan à 24 h', async () => {
            e3 = prepareTerrainEvent('fumee prolongee', 'client', 0, { priceFcfa: 5000 });
            expect(e3.tickets, 'aucun billet émis par la préparation (achat par l’interface)').toEqual([]);
        });

        await test.step('12. achat de 2 billets de E3 par l’interface, puis Mes billets avec le service worker : disponibles hors ligne', async () => {
            if (!e3) throw new Error('événement E3 absent (étape 11 non aboutie)');
            e3Tickets = await buyThroughUi(client, e3.eventId, e3Category, 2);
            e3Numbers = await ticketNumbers(e3Tickets);
            const page = await pageAs('fumee-client', false, { serviceWorkers: 'allow' });
            swClient = page;
            page.context().on('response', (r) => {
                try {
                    if (r.fromServiceWorker() && new URL(r.url()).pathname.startsWith('/api/')) swApiResponses.push(`${r.status()} ${r.url()}`);
                } catch (err) {
                    swApiResponses.push(`URL illisible (${err instanceof Error ? err.message : String(err)})`);
                }
            });
            await page.goto('/tickets');
            for (const number of e3Numbers) {
                const card = page.locator('li, article').filter({ hasText: number }).last();
                await expect(card, `carte du billet ${number} dans Mes billets`).toBeVisible({ timeout: 45_000 });
                await expect(card.locator('[data-ev-offline-state]'), `billet ${number} : « Disponible hors ligne » (téléchargement automatique la veille)`)
                    .toHaveAttribute('data-ev-offline-state', 'available', { timeout: 60_000 });
            }
            const lots = await readStoredLots(page, e3Tickets[1]);
            expect(lots.length, `lot du 2e billet dans IndexedDB : ${lots.length} lot(s)`).toBe(1);
            oldLot = lots[0];
            console.log(`[e2e][fumée] lot hors ligne du billet ${e3Numbers[1]} : version ${oldLot.secret_version}, ${oldLot.count} codes de ${oldLot.step_seconds} s à partir du pas ${oldLot.first_counter}`);
        });

        await test.step('13. hors ligne : page du billet servie par le service worker, QR qui change au bout de ≈ 21 s réelles', async () => {
            const page = swClient;
            if (!page) throw new Error('contexte du client avec service worker absent (étape 12 non aboutie)');
            const failed: string[] = [];
            const consoleErrors: string[] = [];
            await page.context().setOffline(true);
            page.on('requestfailed', (r) => failed.push(`${r.method()} ${r.url()} : ${r.failure()?.errorText ?? 'échec'}`));
            page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
            const res = await page.goto(`/billet/hors-ligne?id=${encodeURIComponent(e3Tickets[0])}`);
            expect(res?.fromServiceWorker(), '/billet/hors-ligne hors ligne : réponse servie par le service worker').toBe(true);
            const qr = page.locator('[data-ev-qr-payload]');
            await expect(qr, 'QR du billet 1 affiché hors ligne').toBeVisible({ timeout: 20_000 });
            const first = await qr.getAttribute('data-ev-qr-counter');
            expect(first, 'pas du QR affiché (data-ev-qr-counter)').toMatch(/^\d+$/);
            await expect.poll(async () => qr.getAttribute('data-ev-qr-counter'), {
                message: 'le QR hors ligne change de pas au bout de ≈ 21 s réelles', timeout: 35_000, intervals: [1_000],
            }).not.toBe(first);
            expect(failed, 'aucune requête en échec sur la page hors ligne').toEqual([]);
            expect(consoleErrors, 'aucune erreur de console sur la page hors ligne').toEqual([]);
        });

        await test.step('14. contrôleur A en ligne : QR lu sur le téléphone hors ligne du client → entrée validée', async () => {
            if (!e3 || !swClient) throw new Error('étapes 11 à 13 non abouties');
            const clientPage: Page = swClient;
            controller = await pageAs('fumee-controleur', false, { scanProbe: true });
            await openScanner(controller, e3.title);
            const payload = String(await clientPage.locator('[data-ev-qr-payload]').getAttribute('data-ev-qr-payload'));
            expect(payload, 'payload affiché hors ligne : <préfixe>:<billet 1>:<6 chiffres>').toMatch(new RegExp(`:${e3Tickets[0]}:\\d{6}$`));
            await presentPayload(controller, payload, 'billet 1 présenté hors ligne');
            await expect(controller.locator('[data-scan-result="valid"]').first(), 'billet 1 hors ligne : « valid »').toBeVisible();
        });

        await test.step('15. transfert du billet 2 au second client, acceptation, puis ancien code présenté → refusé (qr_expired)', async () => {
            if (!e3 || !oldLot || !controller) throw new Error('étapes 11 à 14 non abouties');
            const lot: StoredLot = oldLot;
            const ctl: Page = controller;
            const recipient = verifyHolderPhone('client-bis');
            console.log(`[e2e][fumée] numéro du second client ${recipient.changed ? 'marqué vérifié' : 'déjà vérifié'} (${recipient.verifiedAt})`);
            await client.goto('/tickets');
            const card = client.locator('li, article').filter({ hasText: e3Numbers[1] }).last();
            await card.getByRole('button', { name: /^transférer$/i }).click();
            const dialog = client.getByRole('dialog', { name: /^transférer ce billet$/i });
            await expect(dialog).toBeVisible();
            await dialog.getByLabel(/^numéro de téléphone du destinataire/i).fill(FIXTURE_USERS.CLIENT_BIS.phone.replace(/^\+221/, ''));
            const sent = client.waitForResponse((r) => new URL(r.url()).pathname === `/api/tickets/${e3Tickets[1]}/transfer` && r.request().method() === 'POST');
            await dialog.getByRole('button', { name: /^envoyer le billet$/i }).click();
            const sentRes = await sent;
            expect(sentRes.status(), `transfert du billet 2 : ${(await sentRes.text()).slice(0, 300)}`).toBe(200);
            await dialog.getByRole('button', { name: /^terminer$/i }).click();

            const bis = await pageAs('fumee-client-bis');
            await bis.goto('/tickets?tab=recus');
            const offer = bis.locator('li, article, section').filter({ hasText: e3.title }).filter({ has: bis.getByRole('button', { name: /^accepter le billet$/i }) }).last();
            await offer.getByRole('button', { name: /^accepter le billet$/i }).click();
            const confirm = bis.getByRole('dialog').or(bis.getByRole('alertdialog'));
            await expect(confirm).toBeVisible();
            const claimed = bis.waitForResponse((r) => /^\/api\/tickets\/transfers\/[^/]+\/claim$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST');
            await confirm.getByRole('button', { name: /^accepter le billet$/i }).click();
            const claimRes = await claimed;
            expect(claimRes.status(), `acceptation du transfert : ${(await claimRes.text()).slice(0, 300)}`).toBe(200);

            const old = payloadFromLot(lot);
            console.log(`[e2e][fumée] ancien code du billet ${e3Numbers[1]} (version ${lot.secret_version}, pas ${old.counter}) présenté au contrôleur`);
            await presentPayload(ctl, old.payload, 'ancien code du billet 2 après le transfert');
            await expect(ctl.locator('[data-scan-result="qr_expired"]').first(), 'ancien code après le transfert : « qr_expired » (D3)').toBeVisible();
        });

        await test.step('16. caches du client : coquille hors ligne seulement, rien de /api/ ; route des codes jamais servie hors ligne', async () => {
            const page = swClient;
            if (!page) throw new Error('contexte du client avec service worker absent');
            const keys = await page.evaluate(async () => (await caches.keys()).sort());
            expect(keys, `caches du client : seul ${OFFLINE_CACHE} attendu`).toEqual([OFFLINE_CACHE]);
            const urls = await page.evaluate(async (name) => (await (await caches.open(name)).keys()).map((r) => r.url), OFFLINE_CACHE);
            const forbidden = urls.filter((u) => {
                const url = new URL(u);
                return url.pathname.startsWith('/api/') || url.searchParams.has('_rsc');
            });
            expect(forbidden, `aucune URL /api/ ni _rsc dans ${OFFLINE_CACHE} (${urls.length} entrée(s))`).toEqual([]);
            expect(swApiResponses, 'aucune réponse /api/ servie par le service worker').toEqual([]);
            await page.context().setOffline(true);
            const outcome = await page.evaluate(async (id) => {
                try {
                    const r = await fetch(`/api/tickets/${id}/offline-codes`, { cache: 'no-store' });
                    return `servi (HTTP ${r.status})`;
                } catch (err) {
                    return `rejeté (${err instanceof Error ? err.message : String(err)})`;
                }
            }, e3Tickets[0]);
            expect(outcome, 'hors ligne, la route des codes n’est jamais servie depuis un cache').toMatch(/^rejeté/);
        });
    } finally {
        // Lot 7 (étape 11) : réglage access.scan_window_before_hours remis, même après un échec
        if (e3) restoreTerrainSetting(e3);
        const notices = guards.flatMap(({ role, guard }) => guard.nonBlockingIssues().map((i) => `${role} : ${i}`));
        if (notices.length > 0) console.log(`[e2e][fumée] avertissements non bloquants du navigateur :\n${notices.join('\n')}`);
        const issues = guards.flatMap(({ role, guard }) => guard.blockingIssues().map((i) => `${role} : ${i}`));
        if (issues.length > 0) {
            await testInfo.attach('erreurs-navigateur.txt', { body: issues.join('\n'), contentType: 'text/plain' });
            console.log(`[e2e][fumée] erreurs observées dans le navigateur :\n${issues.join('\n')}`);
        }
        for (const c of contexts) await c.close();
    }
});

test('pages et routes de développement : 404 sur next start, avec et sans session', async ({ browser }, testInfo) => {
    const anonymous = await browser.newContext(projectContextOptions(testInfo));
    await prepareContext(anonymous, 'clair');
    const signedIn = await openRoleContext(browser, testInfo, 'fumee-client');
    try {
        const seen: string[] = [];
        const expected: string[] = [];
        for (const [who, context] of [['sans session', anonymous], ['avec session', signedIn]] as const) {
            for (const [method, url] of [['GET', '/dev/paiements'], ['GET', '/api/dev/samirpay/x'], ['POST', '/api/dev/samirpay/x']] as const) {
                const res = await context.request.fetch(url, { method, maxRedirects: 0 });
                seen.push(`${who} ${method} ${url} : ${res.status()}`);
                expected.push(`${who} ${method} ${url} : 404`);
            }
        }
        expect(seen, 'aucune redirection vers la connexion, aucun 401 : ces adresses n’existent pas sur un build').toEqual(expected);
    } finally {
        await anonymous.close();
        await signedIn.close();
    }
});
