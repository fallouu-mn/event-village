/**
 * Contre-vérification du lot Carte B3 (branche carte-b3/cv-rouges, jamais fusionnée) — trous trouvés.
 * Chaque test est ROUGE tant que le trou existe ; vert = attaque bloquée. Base locale seulement (garde-fou des tests).
 *
 *  T1. REST encore ouverte sur halls et venues (consigne, point 2 : aucune lecture REST par les rôles publics) : la
 *      migration 20261210000001 ne retire que address, latitude, longitude ; la clé anon et le jeton d'un attaquant
 *      lisent toujours les lignes, dont `validated_by` (identifiant du compte de l'administratrice qui a validé) et
 *      `partner_id`.
 *  T2. Raison sociale (« Nom légal de la société » à l'inscription) rendue publiquement : quand le nom commercial
 *      (facultatif) est vide, recherche, fiches et carte des événements rendent `company_name` ; la vue
 *      public_partners la rend pour toute partenaire VALIDE, et halls.partner_id (T1) y mène.
 *  T3. Publication sans position : VALIDE → PUBLIE n'est pas contrôlé par event_transition (seuls l'envoi et la
 *      validation le sont) ; un événement validé avant l'obligation est publié sans position.
 *  T4. Modification d'un établissement : nom (ou position, photos) enregistrés, PUIS horaires refusés → erreur rendue à la
 *      partenaire, écriture gardée et cache de la carte jamais vidé (ancien nom ou ancien point jusqu'à 60 s).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { anonClient, api, show, userClient, type Reply } from './cvf1-helpers';
import { newBuyer, service, type Buyer } from '../parcours/paiement-helpers';
import { newPartner, superadminId, type TestPartner } from '../parcours/finance-helpers';
import { newHall, openHallsService } from '../parcours/l10a-helpers';
import { newTable, newVenue, openTablesService } from '../parcours/l11a-helpers';
import { createDraftEvent, eventStatus, rpcTransition } from '../parcours/cycle-helpers';
import { readMapEntries } from '../../lib/events/map-data.server';
import { TableService } from '../../lib/tables/table.service';

const TOKEN = `cvcb3${randomBytes(4).toString('hex')}`;
const LEGAL = `RaisonLegale${TOKEN}`;

let restoreHalls: () => Promise<void>;
let restoreTables: () => Promise<void>;
let owner: TestPartner;
let attacker: Buyer;
let hallId: string;
let venueId: string;
let hallName: string;
let venueName: string;

const text = (r: Reply | unknown): string => JSON.stringify(r);

before(async () => {
    restoreHalls = await openHallsService();
    restoreTables = await openTablesService();
    owner = await newPartner('cvcb3');
    attacker = await newBuyer('cvcb3-attaquant');
    // Partenaire sans nom commercial (champ facultatif à l'inscription) : la raison sociale est son seul nom
    const { error } = await service.from('partners').update({ commercial_name: null, company_name: LEGAL }).eq('id', owner.partnerId);
    assert.equal(error, null, error?.message);
    hallId = await newHall(owner);
    venueId = await newVenue(owner);
    await newTable(owner, venueId, 4);
    hallName = String((await service.from('halls').select('name').eq('id', hallId).single()).data?.name);
    venueName = String((await service.from('venues').select('name').eq('id', venueId).single()).data?.name);
});

after(async () => {
    await restoreHalls();
    await restoreTables();
});

describe('T1 — REST : salles et établissements encore lisibles par les rôles publics', () => {
    for (const [table, id] of [['halls', () => hallId], ['venues', () => venueId]] as const) {
        test(`${table} : aucune ligne pour la clé anon ni pour le jeton d’un attaquant`, async () => {
            const seen: string[] = [];
            for (const [who, client] of [['anon', anonClient()], ['attaquant', userClient(attacker.accessToken)]] as const) {
                const { data, error } = await client.from(table).select('id').eq('id', id());
                if ((data ?? []).length > 0) seen.push(`${who} lit la ligne (erreur : ${error?.message ?? 'aucune'})`);
            }
            assert.deepEqual(seen, [], `${table} lisible par la REST`);
        });
    }

    test('halls.validated_by : l’identifiant du compte de l’administratrice n’est jamais rendu', async () => {
        const admin = await superadminId();
        const { data } = await anonClient().from('halls').select('id, partner_id, validated_by').eq('id', hallId);
        assert.ok(!text(data).includes(admin), `identifiant de compte rendu à anon : ${text(data)}`);
    });
});

describe('T2 — raison sociale de la partenaire dans les réponses publiques', () => {
    test('recherches, fiches et tables des lieux : la raison sociale n’est jamais rendue', async () => {
        const replies: Array<[string, Reply]> = [
            ['recherche des salles', await api('GET', 'halls', { path: `/api/halls?q=${encodeURIComponent(hallName)}` })],
            ['fiche de la salle', await api('GET', 'halls/[id]', { params: { id: hallId }, path: `/api/halls/${hallId}` })],
            ['recherche des établissements', await api('GET', 'tables', { path: `/api/tables?q=${encodeURIComponent(venueName)}` })],
            ['fiche de l’établissement', await api('GET', 'tables/[id]', { params: { id: venueId }, path: `/api/tables/${venueId}` })],
        ];
        const leaks = replies.filter(([, r]) => text(r.body).includes(LEGAL)).map(([what, r]) => `${what} : ${show(r)}`);
        assert.ok(replies.every(([, r]) => r.status === 200), replies.map(([w, r]) => `${w} ${r.status}`).join(', '));
        assert.deepEqual(leaks, [], 'raison sociale rendue');
    });

    test('recherche : la raison sociale tapée ne retrouve pas les lieux (oracle)', async () => {
        const halls = await api('GET', 'halls', { path: `/api/halls?q=${encodeURIComponent(LEGAL)}` });
        const venues = await api('GET', 'tables', { path: `/api/tables?q=${encodeURIComponent(LEGAL)}` });
        assert.deepEqual([halls.body.total, venues.body.total], [0, 0], `${show(halls)} | ${show(venues)}`);
    });

    test('vue public_partners : la raison sociale n’est pas lisible par la clé anon (partner_id des lieux y mène)', async () => {
        const { data } = await anonClient().from('public_partners').select('*').eq('id', owner.partnerId);
        assert.ok(!text(data).includes(LEGAL), `raison sociale lisible : ${text(data)}`);
    });

    test('événement publié : carte et fiche ne rendent pas la raison sociale', async () => {
        const d = await createDraftEvent(owner, 'cvcb3-legal', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 72 });
        const admin = await superadminId();
        for (const [actor, to] of [[owner.userId, 'EN_ATTENTE'], [admin, 'VALIDE'], [owner.userId, 'PUBLIE']] as const) {
            const r = await rpcTransition(d.eventId, actor, to);
            assert.equal(r.data?.ok, true, `${to} : ${JSON.stringify(r.data)}`);
        }
        // Carte : seule la partie publique (pub) sort ; `f.subtitle` (raison sociale) sert au filtre « q » (constat au rapport)
        const onMap = (await readMapEntries()).filter((e) => e.pub.id === d.eventId).map((e) => e.pub);
        assert.equal(onMap.length, 1, 'événement absent de la carte');
        const sheet = await api('GET', 'events/[id]', { params: { id: d.eventId }, path: `/api/events/${d.eventId}` });
        assert.equal(sheet.status, 200, show(sheet));
        assert.ok(!text(onMap).includes(LEGAL) && !text(sheet.body).includes(LEGAL), `carte : ${text(onMap).slice(0, 300)} | fiche : ${show(sheet)}`);
    });
});

describe('T3 — publication sans position', () => {
    test('VALIDE → PUBLIE refusé en base sans position (événement validé avant l’obligation)', async () => {
        const d = await createDraftEvent(owner, 'cvcb3-publie', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 72 });
        const admin = await superadminId();
        assert.equal((await rpcTransition(d.eventId, owner.userId, 'EN_ATTENTE')).data?.ok, true);
        assert.equal((await rpcTransition(d.eventId, admin, 'VALIDE')).data?.ok, true);
        // État d'un événement validé avant la finition 2a / le lot : aucune position
        const { error } = await service.from('events').update({ latitude: null, longitude: null }).eq('id', d.eventId);
        assert.equal(error, null, error?.message);
        const r = await rpcTransition(d.eventId, owner.userId, 'PUBLIE');
        assert.deepEqual([r.data?.ok, r.data?.code, await eventStatus(d.eventId)], [false, 'POSITION_REQUIRED', 'VALIDE'], JSON.stringify(r.data));
    });
});

describe('T4 — modification d’un établissement : écriture partielle, carte non vidée', () => {
    /** Appels d'invalidation des lieux (journalisés hors du serveur Next : lib/lieux/cache-lieux.server.ts). */
    async function invalidations(fn: () => Promise<unknown>): Promise<{ calls: number; error: unknown }> {
        const original = console.info;
        let calls = 0;
        console.info = (...args: unknown[]) => {
            if (String(args[0] ?? '').startsWith('[lieux-publics]')) calls += 1;
            else original(...args);
        };
        let error: unknown = null;
        try {
            await fn();
        } catch (err) {
            error = err;
        } finally {
            console.info = original;
        }
        return { calls, error };
    }

    test('témoin : un changement de nom accepté vide la carte', async () => {
        const r = await invalidations(() => TableService.updateVenue(owner.userId, venueId, { name: `TEST Témoin ${TOKEN}` }));
        assert.equal(r.error, null, String(r.error));
        assert.ok(r.calls >= 1, 'aucune invalidation journalisée : le témoin ne mesure rien');
    });

    test('nom changé + horaires refusés : rien d’écrit, ou la carte est vidée', async () => {
        const renamed = `TEST Renommé ${TOKEN}`;
        const r = await invalidations(() => TableService.updateVenue(owner.userId, venueId, {
            name: renamed, hours: [{ weekday: 1, opens_at: '12:00', closes_at: '12:00' }],
        }));
        assert.ok(r.error, 'horaires invalides acceptés : le scénario ne s’applique pas');
        const { data } = await service.from('venues').select('name').eq('id', venueId).single();
        const written = data?.name === renamed;
        assert.ok(!written || r.calls >= 1,
            `erreur rendue (« ${r.error instanceof Error ? r.error.message : String(r.error)} ») mais nom enregistré (${String(data?.name)}) et ${r.calls} invalidation`);
    });
});
