# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 1. téléphone en avance de 5 min : codes téléchargés, hors ligne, QR accepté par le contrôleur
- Location: e2e/terrain.spec.ts:122:9

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('[data-ev-ticket-thumb]').filter({ hasText: 'TCK-20261119-2DF6F0A05C' }).first().getByRole('button')
    - locator resolved to <button type="button" class="ev-press flex min-h-11 w-full flex-col gap-1 px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring bg-scan-cat-blanc-bg text-scan-cat-blanc-fg">…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
  - element was detached from the DOM, retrying

```

# Test source

```ts
  1   | /**
  2   |  * Lot 8 (contrat 15.5, T25, T26) — outils des parcours de bout en bout, partagés par la fumée (e2e/fumee.spec.ts), le projet
  3   |  * terrain (e2e/terrain.spec.ts) et la recette (e2e/recette.spec.ts). Extraits de ces fichiers sans changement de
  4   |  * comportement ; seul ajout : le numéro de paiement facultatif de buyThroughUi, celui du client de la fumée par défaut.
  5   |  * Fin de fichier : outils propres à la recette (codes SMS, réglages, boîte d'envoi par la vraie route, invariants).
  6   |  */
  7   | import { spawnSync } from 'node:child_process';
  8   | import path from 'node:path';
  9   | import type { Locator, Page } from '@playwright/test';
  10  | import { expect } from '@playwright/test';
  11  | import { fumeePayerPhone } from './accounts';
  12  | import { APP_URL, e2eConfig, E2E_ENV_FILE } from './env';
  13  | import { outboxByProviderIds, serviceClient, type OutboxLine, type SentSmsLine } from './service';
  14  | 
  15  | export function escapeRe(s: string): string {
  16  |     return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  17  | }
  18  | 
  19  | /** Date et heure (Africa/Dakar = UTC+0) au format des champs date et time. */
  20  | export function dakarParts(d: Date): { date: string; time: string } {
  21  |     const iso = d.toISOString();
  22  |     return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
  23  | }
  24  | 
  25  | /**
  26  |  * Décision du 19/11 (Mes billets, option 1) : sur téléphone, seul le billet affiché est complet ; les autres sont des
  27  |  * vignettes (data-ev-ticket-thumb, titre, date, numéro). Ouvre la vignette qui contient ce texte, s'il y en a une.
  28  |  */
  29  | export async function openTicketThumb(page: Page, text: string): Promise<void> {
  30  |     const thumb = page.locator('[data-ev-ticket-thumb]').filter({ hasText: text });
> 31  |     if (await thumb.count() > 0) await thumb.first().getByRole('button').click();
      |                                                                          ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  32  | }
  33  | 
  34  | /** Plus petit bloc qui contient le titre de l'événement et le bouton demandé (carte de la liste). */
  35  | export function cardOf(page: Page, title: string, action: RegExp): Locator {
  36  |     return page.locator('li, article, tr, section, div')
  37  |         .filter({ has: page.getByText(title, { exact: true }) })
  38  |         .filter({ has: page.getByRole('button', { name: action }) })
  39  |         .last();
  40  | }
  41  | 
  42  | /** Clic sur une action ; si une modale de confirmation s'ouvre, elle est confirmée (même libellé ou « Confirmer »). */
  43  | export async function actionWithConfirm(page: Page, scope: Locator, action: RegExp): Promise<void> {
  44  |     await scope.getByRole('button', { name: action }).click();
  45  |     const dialog = page.getByRole('dialog').or(page.getByRole('alertdialog'));
  46  |     if (await dialog.isVisible()) {
  47  |         await dialog.getByRole('button', { name: new RegExp(`${action.source}|confirmer`, 'i') }).last().click();
  48  |         await expect(dialog).toBeHidden();
  49  |     }
  50  | }
  51  | 
  52  | /** Indicateur de la page de pilotage : plus petit bloc du panneau qui porte le libellé et un nombre. */
  53  | export function kpi(panel: Locator, label: RegExp): Locator {
  54  |     return panel.locator('dl, li, article, section, div')
  55  |         .filter({ has: panel.page().getByText(label) })
  56  |         .filter({ hasText: /\d/ })
  57  |         .last();
  58  | }
  59  | 
  60  | export async function fakeServices(pathName: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  61  |     const res = await fetch(`${e2eConfig().fakeServicesUrl}${pathName}`, {
  62  |         method: 'POST',
  63  |         headers: { 'content-type': 'application/json' },
  64  |         body: JSON.stringify(body),
  65  |     });
  66  |     const text = await res.text();
  67  |     let json: Record<string, unknown>;
  68  |     try {
  69  |         json = text ? JSON.parse(text) as Record<string, unknown> : {};
  70  |     } catch (err) {
  71  |         throw new Error(`faux services ${pathName} : réponse illisible (${err instanceof Error ? err.message : String(err)}) : ${text.slice(0, 200)}`);
  72  |     }
  73  |     return { status: res.status, json };
  74  | }
  75  | 
  76  | // ── Fumée, lot 6 (contrat P3) : étapes 7 à 10 ──────────────────────────────
  77  | 
  78  | export interface FakeSms { ticket: string; msisdn: string; message: string; receivedAt: string }
  79  | 
  80  | /** SMS reçus par le faux MTarget pour ce numéro (200 derniers, plus récent d'abord). */
  81  | export async function fakeSmsTo(phone: string): Promise<FakeSms[]> {
  82  |     const digits = phone.replace(/\D/g, '');
  83  |     const res = await fetch(`${e2eConfig().fakeServicesUrl}/__test/sms?to=${digits}&limit=200`);
  84  |     const text = await res.text();
  85  |     if (!res.ok) throw new Error(`faux MTarget /__test/sms : HTTP ${res.status} ${text.slice(0, 200)}`);
  86  |     let body: { messages?: FakeSms[] };
  87  |     try {
  88  |         body = JSON.parse(text) as { messages?: FakeSms[] };
  89  |     } catch (err) {
  90  |         throw new Error(`faux MTarget /__test/sms : réponse illisible (${err instanceof Error ? err.message : String(err)}) : ${text.slice(0, 200)}`);
  91  |     }
  92  |     if (!Array.isArray(body.messages)) throw new Error(`faux MTarget /__test/sms : liste absente ${text.slice(0, 200)}`);
  93  |     return body.messages;
  94  | }
  95  | 
  96  | /** SMS arrivés depuis le repère (tickets connus avant l'étape), du plus ancien au plus récent. */
  97  | export function smsSince(all: FakeSms[], before: ReadonlySet<string>): FakeSms[] {
  98  |     return all.filter((m) => !before.has(m.ticket)).reverse();
  99  | }
  100 | 
  101 | /** Réglage notif.* entier lu dans platform_settings (valeur historisée du contrat I1). */
  102 | export async function notifSettingInt(key: string): Promise<number> {
  103 |     const { data, error } = await serviceClient().from('platform_settings').select('value').eq('key', key).maybeSingle();
  104 |     if (error) throw new Error(`réglage ${key} : ${error.message}`);
  105 |     const value = Number((data?.value as { value?: unknown } | null | undefined)?.value);
  106 |     if (!Number.isInteger(value)) throw new Error(`réglage ${key} illisible : ${JSON.stringify(data)}`);
  107 |     return value;
  108 | }
  109 | 
  110 | /** Heure de Dakar dans la plage de silence [start, end) (plage vide si start = end, à cheval sur minuit si start > end). */
  111 | export function inQuietHours(hour: number, start: number, end: number): boolean {
  112 |     if (start === end) return false;
  113 |     return start > end ? hour >= start || hour < end : hour >= start && hour < end;
  114 | }
  115 | 
  116 | /** Jour de Dakar (AAAA-MM-JJ, UTC+0) décalé de `offset` jours. */
  117 | export function dakarDayFrom(base: Date, offset: number): string {
  118 |     const d = new Date(base.getTime());
  119 |     d.setUTCDate(d.getUTCDate() + offset);
  120 |     return d.toISOString().slice(0, 10);
  121 | }
  122 | 
  123 | /** Données de rendu comme l'envoyeur (dispatcher.ts, renderData) : template_data complété, sans rien écraser. */
  124 | export function renderData(row: OutboxLine, event: Record<string, unknown>): Record<string, unknown> {
  125 |     const data: Record<string, unknown> = { ...(row.template_data ?? {}) };
  126 |     for (const [k, v] of Object.entries(event)) if (data[k] === undefined) data[k] = v;
  127 |     return data;
  128 | }
  129 | 
  130 | export function brief(rows: OutboxLine[]): string {
  131 |     return JSON.stringify(rows.map((r) => ({ type: r.type, channel: r.channel, status: r.status, reason: r.reason, user: r.recipient_user_id })));
```