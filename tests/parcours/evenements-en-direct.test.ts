/**
 * Lot 9 ter, tâche 9t.8 (consigne 0.8, R49 ; contrat 5.B 9t.8, B.5 points 1 à 4, décisions B-D13 et B-D14) — « En
 * direct » seulement si les ventes sont suivies en temps réel :
 *  1. le pilotage d'un événement s'abonne aussi à ticket_categories, filtré par l'événement (les ventes, invitations
 *     et remboursements écrivent sold_quantity) ;
 *  2. la liste des événements de la partenaire et le tableau de bord admin, qui ne suivent pas les ventes, passent
 *     salesLive={false} et une heure de mise à jour déjà formatée à LiveIndicator ;
 *  3. LiveIndicator : « Mis à jour à {heure} » (jamais « En direct ») quand les ventes ne sont pas suivies,
 *     « Hors ligne · mis à jour à {heure} » hors ligne, « Mise à jour en cours » sans heure ; « En direct » inchangé ;
 *  4. la propriétaire reçoit un signal de ticket_categories à chaque vente ou invitation de son événement (charge sans
 *     sold_quantity ni held_quantity) ; une autre partenaire et anon ne reçoivent rien d'un événement non public ;
 *  5. useServerData expose updatedAt, posé à chaque lecture réussie.
 * Cas 1, 2, 3, 5 sans base (sources et rendu) ; cas 4 avec base et Realtime (clients connectés par mot de passe, clé
 * anon seule).
 *
 * Rouge avant correctif (E-B, fix(9t.8e)) : app/partner/events/[id]/page.tsx:89-99 ne suit pas ticket_categories ;
 * LiveIndicator n'a ni salesLive ni updatedTime (« En direct » toujours) ; useServerData n'a pas updatedAt. Le cas 4
 * est vert aujourd'hui (RLS et publication existantes) : il garde la sécurité du nouvel abonnement.
 * after() : assertLot9terInvariants (la suite écrit au cas 4).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { anonClient, disposeClients, expectNothing, expectSome, signedInClient, subscribeCollect } from '../helpers/realtime';
import { routeContext } from './helpers';
import { importModule, newBuyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { authed } from './acces-helpers';
import { createEventInStatus } from './cycle-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import type { SupabaseClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const PILOTAGE_PAGE = 'app/partner/events/[id]/page.tsx';
const PARTNER_LIST = 'app/partner/events/page.tsx';
const ADMIN_DASHBOARD = 'app/admin/dashboard/page.tsx';
const SERVER_DATA = 'components/partner/useServerData.ts';
const INDICATOR_MODULE = '../../components/ui/LiveIndicator';
const INVITE_ROUTE = '../../app/api/partner/events/[id]/invitations/route';
const CATEGORIES: CategorySpec[] = [{ name: 'Standard', price: 3_000, total: 30 }];

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

function source(rel: string): string {
    const file = path.join(ROOT, rel);
    assert.ok(fs.existsSync(file), `${rel} absent`);
    return stripComments(fs.readFileSync(file, 'utf8'));
}

/** Balises `<LiveIndicator … />` d'une source (attributs compris, sur plusieurs lignes). */
function indicatorTags(src: string): string[] {
    return Array.from(src.matchAll(/<LiveIndicator\b[\s\S]*?\/>/g)).map((m) => m[0]);
}

/** Texte rendu : balises retirées, entités courantes décodées, espaces (insécables compris) repliés. */
function renderedText(html: string): string {
    return html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ')
        .replace(/&#x27;|&#39;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
        .replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
}

describe('9t.8 (R49) : sources et rendu', () => {
    test('le pilotage suit ticket_categories filtré par l\'événement (useRealtimeRefresh)', () => {
        const src = source(PILOTAGE_PAGE);
        assert.match(src, /\buseRealtimeRefresh\s*\(/, 'le pilotage appelle useRealtimeRefresh');
        const objects = Array.from(src.matchAll(/\{[^{}]*\btable\s*:\s*['"]ticket_categories['"][^{}]*\}/g)).map((m) => m[0]);
        assert.ok(objects.length > 0, `${PILOTAGE_PAGE} : aucun abonnement { table: 'ticket_categories' } (aujourd'hui ticket_scans, scan_incidents, controller_shifts, event_status_history seulement)`);
        assert.ok(objects.some((o) => /\bfilter\s*:\s*[`'"]event_id=eq\./.test(o)), `abonnement à ticket_categories filtré par event_id=eq. : ${objects.join(' | ')}`);
    });

    test('liste partenaire et tableau de bord admin : <LiveIndicator salesLive={false} updatedTime=…>', () => {
        for (const rel of [PARTNER_LIST, ADMIN_DASHBOARD]) {
            const tags = indicatorTags(source(rel));
            assert.ok(tags.length > 0, `${rel} : LiveIndicator rendu`);
            assert.ok(tags.some((t) => /\bsalesLive\s*=\s*\{\s*false\s*\}/.test(t) && /\bupdatedTime\s*=/.test(t)),
                `${rel} : salesLive={false} et une heure de mise à jour (B.5 point 4) : ${tags.join(' | ')}`);
        }
    });

    test('rendu de LiveIndicator : l\'heure, jamais « En direct », quand les ventes ne sont pas suivies', async () => {
        const mod = (await importModule(INDICATOR_MODULE)) as Record<string, unknown>;
        assert.equal(typeof mod.LiveIndicator, 'function', 'components/ui/LiveIndicator : LiveIndicator exporté');
        const Indicator = mod.LiveIndicator as ComponentType<Record<string, unknown>>;
        const text = (props: Record<string, unknown>): string => renderedText(renderToStaticMarkup(createElement(Indicator, props)));

        const notFollowed = text({ status: 'live', salesLive: false, updatedTime: '14:32' });
        assert.ok(notFollowed.includes('Mis à jour à 14:32'), `ventes non suivies, en ligne : « ${notFollowed} »`);
        assert.ok(!notFollowed.includes('En direct'), `jamais « En direct » quand les ventes ne sont pas suivies : « ${notFollowed} »`);

        const connecting = text({ status: 'connecting', salesLive: false, updatedTime: '14:32' });
        assert.ok(connecting.includes('Mis à jour à 14:32') && !connecting.includes('En direct'), `ventes non suivies, connexion : « ${connecting} »`);

        const offline = text({ status: 'offline', updatedTime: '14:32' });
        assert.ok(offline.includes('Hors ligne · mis à jour à 14:32'), `hors ligne avec l'heure connue : « ${offline} »`);

        const live = text({ status: 'live' });
        assert.ok(live.includes('En direct'), `ventes suivies : « En direct » inchangé : « ${live} »`);

        const pending = text({ status: 'live', salesLive: false });
        assert.ok(pending.includes('Mise à jour en cours'), `ventes non suivies, sans heure : « ${pending} »`);
        assert.ok(!pending.includes('En direct'), `sans heure, jamais « En direct » : « ${pending} »`);
    });

    test('useServerData pose updatedAt à chaque lecture réussie', () => {
        const src = source(SERVER_DATA);
        const iface = /export\s+interface\s+ServerData<T>\s*\{([\s\S]*?)\n\}/.exec(src);
        assert.ok(iface, 'interface ServerData<T> exportée');
        assert.match(iface[1], /\bupdatedAt\s*:\s*Date\s*\|\s*null\s*;/, `ServerData expose updatedAt: Date | null (B.5 point 2) : ${iface[1].trim()}`);
        const afterSet = /setData\s*\(\s*body\s*\)\s*;([\s\S]{0,300})/.exec(src);
        assert.ok(afterSet, 'setData(body) après une lecture réussie');
        assert.match(afterSet[1], /\bset[A-Z]\w*\s*\(\s*new\s+Date\s*\(\s*\)\s*\)/, `updatedAt posé (new Date()) juste après setData : ${afterSet[1].trim()}`);
    });
});

// ── Temps réel (base) ──────────────────────────────────────────────────────

let owner: TestPartner;
let other: TestPartner;
const clients: SupabaseClient[] = [];

after(async () => {
    await disposeClients(...clients);
    await assertLot9terInvariants('evenements-en-direct');
});

describe('9t.8 (R49) : signal de vente pour la propriétaire seulement', () => {
    before(async () => {
        owner = await newPartner('direct-prop');
        other = await newPartner('direct-autre');
    });

    test('vente d\'un événement PUBLIE : signal ticket_categories à la propriétaire, sans sold_quantity ni held_quantity ; invitation d\'un VALIDE : rien pour une autre partenaire ni pour anon', async () => {
        const ownerClient = await signedInClient(owner);
        const otherClient = await signedInClient(other);
        const anon = anonClient();
        clients.push(ownerClient, otherClient, anon);

        const published = await createEventInStatus(owner, 'direct-publie', CATEGORIES, 'PUBLIE', { startsInHours: 72 });
        const pubFilter = `event_id=eq.${published.eventId}`;
        const ownerPub = subscribeCollect(ownerClient, { table: 'ticket_categories', filter: pubFilter }, { label: 'propriétaire, événement publié' });
        await ownerPub.ready;
        const buyer = await newBuyer('direct-acheteur');
        await buyConfirmed(buyer, published, [['Standard', 1]]);
        const sale = await expectSome(ownerPub, (e) => e.new.event_id === published.eventId, undefined, 'signal de vente pour la propriétaire');
        for (const e of sale) {
            assert.ok(!('sold_quantity' in e.new), `charge sans sold_quantity : ${JSON.stringify(e.new)}`);
            assert.ok(!('held_quantity' in e.new), `charge sans held_quantity : ${JSON.stringify(e.new)}`);
        }

        const validated = await createEventInStatus(owner, 'direct-valide', CATEGORIES, 'VALIDE', { startsInHours: 72 });
        const valFilter = `event_id=eq.${validated.eventId}`;
        const ownerVal = subscribeCollect(ownerClient, { table: 'ticket_categories', filter: valFilter }, { label: 'propriétaire, événement validé' });
        const otherVal = subscribeCollect(otherClient, { table: 'ticket_categories', filter: valFilter }, { label: 'autre partenaire, événement validé' });
        const anonVal = subscribeCollect(anon, { table: 'ticket_categories', filter: valFilter }, { label: 'anon, événement validé' });
        await Promise.all([ownerVal.ready, otherVal.ready, anonVal.ready]);
        const handler = await routeHandler(INVITE_ROUTE, 'POST', 'POST /api/partner/events/[id]/invitations');
        const invited = await invoke(handler, authed(`/api/partner/events/${validated.eventId}/invitations`, 'POST', owner,
            { category_id: validated.categories.Standard.id, phones: [(await newBuyer('direct-invite')).phoneE164], quantity: 1 }), routeContext({ id: validated.eventId }));
        assert.equal(invited.status, 200, `invitation sur un événement VALIDE : ${show(invited)}`);
        await expectSome(ownerVal, (e) => e.new.event_id === validated.eventId, undefined, 'signal d\'invitation pour la propriétaire');
        await expectNothing(otherVal, 3_000, () => true, 'autre partenaire : aucun signal d\'un événement non public');
        await expectNothing(anonVal, 3_000, () => true, 'anon : aucun signal d\'un événement non public');
    });
});
