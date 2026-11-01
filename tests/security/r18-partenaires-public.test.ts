/**
 * R18 — Lot 5, sécurité urgente A2 : anon, un client et un autre partenaire ne lisent ni le téléphone,
 * ni l'email, ni les chemins des pièces, ni aucune donnée administrative d'un partenaire VALIDE.
 * La lecture publique passe par la vue public_partners (id, company_name, logo_url, city, description,
 * status = VALIDE) ou par des privilèges de colonne (contrat A2, les deux formes sont admises).
 *
 * Rouge avant correctif : supabase/migrations/0003_rls.sql:109-110, politique partners_read_public
 * USING (status = 'VALIDE' OR user_id = auth.uid() OR is_admin()), jamais modifiée : toutes les
 * colonnes d'un partenaire VALIDE sont lisibles par anon et par tout compte (phone, email,
 * id_card_url, business_doc_url, rejection_reason, suspended_reason, user_id ; colonnes de
 * 0001_initial_schema.sql:257-260 et 0008_partner_auth_production.sql:11-12). Les partenaires du seed
 * ont un téléphone et un email.
 *
 * Un refus se constate par zéro ligne exposée (politique) ou par un refus de permission (42501,
 * privilèges de colonne) ; une colonne inexistante (42703) n'est pas acceptée comme refus.
 * (Clé anon + signInWithPassword uniquement.)
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { FIXTURE_PARTNERS } from '../helpers/fixture-data';
import { anonClient, signInFixture, signUpAttacker } from './helpers';

type Row = Record<string, unknown>;

const ADMIN_COLUMNS = ['phone', 'email', 'id_card_url', 'business_doc_url', 'rejection_reason', 'suspended_reason', 'user_id'] as const;
const PUBLIC_COLUMNS = ['id', 'company_name', 'logo_url', 'city', 'description', 'status'] as const;

function assertPermissionDenied(error: PostgrestError, what: string): void {
    assert.ok(error.code === '42501' || /permission denied/i.test(error.message),
        `${what} : refus de permission attendu, reçu code=${error.code} message=${error.message}`);
}

/** Aucune colonne administrative d'un partenaire VALIDE (autre que le sien) n'est lisible. */
async function assertNoAdminData(client: SupabaseClient, label: string, ownPartnerId?: string): Promise<void> {
    let named = client.from('partners').select(['id', ...ADMIN_COLUMNS].join(', ')).eq('status', 'VALIDE');
    if (ownPartnerId) named = named.neq('id', ownPartnerId);
    const res = await named;
    if (res.error) {
        assertPermissionDenied(res.error, `${label} : SELECT partners(${ADMIN_COLUMNS.join(', ')})`);
    } else {
        const rows = (res.data ?? []) as unknown as Row[];
        const leaks = rows.filter((r) => ADMIN_COLUMNS.some((c) => r[c] !== null && r[c] !== undefined));
        assert.deepEqual(leaks.map((r) => r.id), [], `${label} : ${leaks.length} partenaire(s) VALIDE exposent leurs données administratives (${ADMIN_COLUMNS.join(', ')})`);
    }

    let star = client.from('partners').select('*').eq('status', 'VALIDE');
    if (ownPartnerId) star = star.neq('id', ownPartnerId);
    const all = await star;
    if (all.error) {
        assertPermissionDenied(all.error, `${label} : SELECT partners(*)`);
    } else {
        const rows = (all.data ?? []) as Row[];
        const leaks = rows.filter((r) => ADMIN_COLUMNS.some((c) => r[c] !== null && r[c] !== undefined));
        assert.deepEqual(leaks.map((r) => r.id), [], `${label} : SELECT * expose les données administratives de ${leaks.length} partenaire(s)`);
    }
}

describe('R18 — données administratives des partenaires non lisibles publiquement', () => {
    test('anon : ni téléphone, ni email, ni pièces, ni données administratives d’un partenaire VALIDE', async () => {
        await assertNoAdminData(anonClient(), 'anon');
    });

    test('compte CLIENT du seed : rien non plus', async () => {
        const { client } = await signInFixture('CLIENT');
        await assertNoAdminData(client, 'CLIENT');
    });

    test('compte fraîchement inscrit : rien non plus', async () => {
        const attacker = await signUpAttacker('r18');
        await assertNoAdminData(attacker.client, 'compte inscrit');
    });

    test('partenaire B : rien des autres partenaires (sa propre fiche exclue)', async () => {
        const b = await signInFixture('PARTNER_B');
        const { data, error } = await b.client.from('partners').select('id').eq('user_id', b.userId).single();
        assert.equal(error, null, `lecture de sa propre fiche : ${error?.message}`);
        await assertNoAdminData(b.client, 'partenaire B', String(data.id));
    });

    test('garde-fou : la fiche publique du partenaire A (nom, ville) reste lisible par anon, sans colonne administrative', async () => {
        const anon = anonClient();
        const name = FIXTURE_PARTNERS.A.companyName;
        const view = await anon.from('public_partners').select('*').eq('company_name', name);
        let rows: Row[];
        if (view.error) {
            // Contrat A2 : la vue est l'une des deux formes admises ; sans vue, privilèges de colonne sur partners.
            assert.ok(['PGRST205', '42P01'].includes(view.error.code), `vue public_partners : erreur inattendue ${view.error.code} ${view.error.message}`);
            const direct = await anon.from('partners').select(PUBLIC_COLUMNS.join(', ')).eq('company_name', name);
            assert.equal(direct.error, null, `lecture publique des colonnes publiques de partners : ${direct.error?.message}`);
            rows = (direct.data ?? []) as unknown as Row[];
        } else {
            rows = (view.data ?? []) as Row[];
            const exposed = rows.flatMap((r) => ADMIN_COLUMNS.filter((c) => c in r));
            assert.deepEqual(exposed, [], `la vue public_partners expose des colonnes administratives : ${exposed.join(', ')}`);
        }
        assert.equal(rows.length, 1, `fiche publique du partenaire A lisible (trouvé ${rows.length})`);
        assert.equal(rows[0].company_name, name, 'nom du partenaire A');
    });
});
