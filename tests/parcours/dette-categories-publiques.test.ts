/**
 * Lot 5, tâche 5.0 — sécurité urgente A3 (complément de tests/security/r19-categories-transferts.test.ts) :
 * lecture REST de ticket_categories par anon, un client et un autre partenaire. Contrat : section A3 de
 * la conception du lot 5.
 *  - anon et client : seulement les catégories is_active AND is_visible d'un événement dans un statut
 *    public (PUBLIE, SUSPENDU, ANNULE, TERMINE) ;
 *  - partenaire propriétaire et admins : toutes les catégories ;
 *  - le partenaire B ne lit pas les catégories non publiques de A.
 * Cette suite est dans tests/parcours parce qu'elle prépare, par le service_role, des catégories
 * masquées ou inactives et des événements non publics qui n'existent pas dans le seed (la règle des
 * tests de sécurité interdit le service_role) ; les lectures elles-mêmes se font avec la clé anon et
 * signInWithPassword.
 *
 * Rouge avant correctif : supabase/migrations/0003_rls.sql:141-146, politique ticket_categories_read_public
 * USING (is_active = TRUE OR propriétaire OR is_admin()) : une catégorie active est lisible par tous,
 * masquée (is_visible = false) ou non, quel que soit le statut de l'événement (BROUILLON, VALIDE…).
 *
 * Interprétation retenue : un refus de lecture se constate par zéro ligne (RLS) ou par un refus de
 * permission (42501).
 * La suite crée ses partenaires, son client, son admin et ses événements.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import { anonClient, signedInClient } from '../helpers/realtime';
import { createDraftEvent, type DraftEvent } from './cycle-helpers';
import { newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent } from './acces-helpers';

let owner: TestPartner;
let other: TestPartner;
let client: Buyer;
let admin: Buyer;
let published: SaleEvent;
let suspended: SaleEvent;
let draft: DraftEvent;
let validated: SaleEvent;

before(async () => {
    owner = await newPartner('cat-publiques');
    other = await newPartner('cat-publiques-b');
    client = await newBuyer('cat-client');
    admin = await newBuyer('cat-admin', { firstName: 'Aminata', lastName: 'Administratrice' });
    const { error } = await service.from('user_roles').upsert([{ user_id: admin.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
    assert.equal(error, null, `rôle ADMIN : ${error?.message}`);
    const categories = [
        { name: 'Visible', price: 4000, total: 10 },
        { name: 'Masquee', price: 9000, total: 5, isVisible: false },
        { name: 'Inactive', price: 2000, total: 5, isActive: false },
    ];
    published = await createTimedEvent(owner.partnerId, 'cat-publie', categories, { startsInHours: 48 });
    suspended = await createTimedEvent(owner.partnerId, 'cat-suspendu', categories, { startsInHours: 48, status: 'SUSPENDU' });
    validated = await createTimedEvent(owner.partnerId, 'cat-valide', [{ name: 'Standard', price: 3000, total: 10 }], { startsInHours: 48, status: 'VALIDE' });
    draft = await createDraftEvent(owner, 'cat-brouillon', [{ name: 'Standard', price: 3000, total: 10 }], { startsInHours: 48 });
});

after(async () => {
    await assertLifecycleInvariants('dette-categories-publiques');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function idsOf(ev: SaleEvent, names?: string[]): string[] {
    return Object.entries(ev.categories).filter(([name]) => !names || names.includes(name)).map(([, c]) => c.id).sort();
}

/** Identifiants lisibles par ce client parmi `ids`, ou null si la lecture est refusée par permission (42501). */
async function readable(c: SupabaseClient, ids: string[], label: string): Promise<string[] | null> {
    const { data, error } = await c.from('ticket_categories').select('id').in('id', ids);
    if (error) {
        assert.ok(error.code === '42501' || /permission denied/i.test(error.message), `${label} : erreur inattendue ${error.code} ${error.message}`);
        return null;
    }
    return (data ?? []).map((r) => String(r.id)).sort();
}

async function viewers(): Promise<Array<[string, SupabaseClient]>> {
    return [
        ['anon', anonClient()],
        ['client', await signedInClient({ email: client.email })],
        ['partenaire B', await signedInClient({ email: other.email })],
    ];
}

// ── A3 ─────────────────────────────────────────────────────────────────────

describe('A3 — lecture publique de ticket_categories', () => {
    test('événement PUBLIE : anon, client et partenaire B ne lisent que la catégorie active et visible', async () => {
        const all = idsOf(published);
        const visible = idsOf(published, ['Visible']);
        for (const [label, c] of await viewers()) {
            const got = await readable(c, all, label);
            assert.deepEqual(got, visible, `${label} : seule la catégorie active et visible est lisible (masquée et inactive exclues)`);
        }
    });

    test('événements non publics (BROUILLON, VALIDE) : anon, client et partenaire B ne lisent aucune catégorie', async () => {
        const ids = [...idsOf(draft), ...idsOf(validated)].sort();
        for (const [label, c] of await viewers()) {
            const got = await readable(c, ids, label);
            assert.ok(got === null || got.length === 0, `${label} : catégories d’événements non publics lisibles : ${JSON.stringify(got)}`);
        }
    });

    test('garde-fou : le partenaire propriétaire et un admin lisent toutes les catégories (masquées, inactives, non publiques)', async () => {
        const ids = [...idsOf(published), ...idsOf(draft), ...idsOf(validated)].sort();
        for (const [label, who] of [['propriétaire', owner], ['admin', admin]] as Array<[string, Buyer]>) {
            const got = await readable(await signedInClient({ email: who.email }), ids, label);
            assert.deepEqual(got, ids, `${label} : toutes ses catégories lisibles`);
        }
    });

    test('garde-fou : statut public SUSPENDU → anon lit encore la catégorie active et visible (pas l’inactive)', async () => {
        const got = await readable(anonClient(), idsOf(suspended), 'anon');
        assert.ok(got !== null, 'anon : lecture publique des catégories d’un événement SUSPENDU refusée');
        assert.ok(got.includes(suspended.categories.Visible.id), 'catégorie active et visible d’un événement SUSPENDU lisible');
        assert.ok(!got.includes(suspended.categories.Inactive.id), 'catégorie inactive non lisible');
    });
});
