/**
 * Audit de sécurité du module événements — comptes : surface GoTrue appelable directement avec la clé anon publique.
 *
 * Constats prouvés (tests ROUGES tant que la faille existe ; aucun correctif dans cette branche) :
 *  AUD-01 — un visiteur s'inscrit chez GoTrue (POST /auth/v1/signup, inscription publique ouverte : supabase/config.toml
 *           [auth] enable_signup = true, docs/deploiement-projet-neuf.md:23) avec l'adresse technique d'un numéro
 *           (`<numéro sans +>@eventvillage.sn`, lib/auth/account-sync.ts:16-17) : le vrai titulaire reçoit son code
 *           (SMS payé) mais ne peut plus jamais s'inscrire (409 ACCOUNT_ALREADY_EXISTS, app/api/auth/register/route.ts:179-184).
 *  AUD-02 — avec le seul jeton d'une session (volée), PUT /auth/v1/user change le mot de passe sans le mot de passe
 *           actuel (config.toml secure_password_change = false ; la route applicative l'exige :
 *           app/api/account/password/route.ts:28, 116), et l'alerte PASSWORD_CHANGED est supprimée en posant d'abord
 *           la métadonnée is_temporary_controller_account (notif_on_password_changed,
 *           20261109000009_lot9bis_messages.sql:1623-1625 : lue dans raw_user_meta_data, que l'utilisateur écrit).
 *  AUD-03 — un compte ouvert par l'inscription publique (aucun numéro, aucun code) est ACTIF (handle_new_user,
 *           20261031000002_lot1a_failles_sans_privilege.sql:32-42) et prend des billets gratuits : la limite « par
 *           compte » (claim_free_user, app/api/tickets/claim-free/route.ts) ne borne plus rien.
 *
 * Montage par le service_role (événement, catégories, lecture des résultats) ; l'attaque n'utilise que la clé anon,
 * GoTrue et les routes de l'application, comme un visiteur.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { BASE_URL, randomSenegalPhone, STRONG_PASSWORD } from '../parcours/helpers';
import { createSaleEvent, newBuyer, service } from '../parcours/paiement-helpers';
import { lastSmsCode, registerStart, registerSubmit } from '../parcours/terrain-helpers';
import { outboxRows } from '../parcours/notif-helpers';
import { getFakes } from '../fakes';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function anon() {
    return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

/** PUT /auth/v1/user avec le seul jeton d'accès, comme le ferait un voleur de session. */
async function gotrueUpdateUser(accessToken: string, body: Record<string, unknown>): Promise<{ status: number; text: string }> {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: { apikey: ANON_KEY, authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
    return { status: res.status, text: (await res.text()).slice(0, 300) };
}

let ipSeq = 0;
function freshIp(): Record<string, string> {
    ipSeq += 1;
    return { 'x-forwarded-for': `198.51.100.${(ipSeq % 250) + 1}` };
}

describe('AUD-01 — inscription publique GoTrue : squat de l\'adresse technique d\'un numéro', () => {
    test('le titulaire d\'un numéro dont l\'adresse technique a été prise par un visiteur peut encore s\'inscrire', async () => {
        const phone = randomSenegalPhone('77');
        const technicalEmail = `${phone.replace('+', '')}@eventvillage.sn`;

        // Attaque : un visiteur, clé anon seule, sans aucun code
        const squat = await anon().auth.signUp({ email: technicalEmail, password: `Squat#${randomBytes(6).toString('hex')}` });
        console.log(`[AUD-01] signUp(${technicalEmail}) : erreur=${squat.error?.message ?? 'aucune'} utilisateur=${squat.data.user?.id ?? 'aucun'}`);
        const { data: squatRow } = await service.from('users').select('id, status, phone, email').eq('email', technicalEmail).maybeSingle();
        console.log(`[AUD-01] public.users après le signUp : ${JSON.stringify(squatRow)}`);

        // Le vrai titulaire : démarrage (SMS envoyé) puis inscription avec le bon code
        const since = getFakes().sms.messagesTo(phone).length;
        const start = await registerStart(phone, freshIp());
        console.log(`[AUD-01] register/start : HTTP ${start.status} ${JSON.stringify(start.body).slice(0, 200)} ; SMS reçus : ${getFakes().sms.messagesTo(phone).length - since}`);
        assert.equal(start.status, 200, `démarrage de l'inscription du titulaire : HTTP ${start.status} ${JSON.stringify(start.body)}`);
        const code = lastSmsCode(phone, since);
        assert.ok(code, 'le titulaire a reçu son code par SMS');
        const submit = await registerSubmit({ phone, code, firstName: 'Titulaire', lastName: 'DuNumero', password: STRONG_PASSWORD }, freshIp());
        console.log(`[AUD-01] register : HTTP ${submit.status} ${JSON.stringify(submit.body).slice(0, 300)}`);
        assert.equal(submit.status, 200,
            `inscription du titulaire refusée après le squat de ${technicalEmail} par un visiteur : HTTP ${submit.status} ${JSON.stringify(submit.body)}`);
    });
});

describe('AUD-02 — changement de mot de passe direct chez GoTrue sans mot de passe actuel, alerte supprimée', () => {
    test('GoTrue refuse un nouveau mot de passe présenté avec le seul jeton d’une session (sans le mot de passe actuel)', async () => {
        const victim = await newBuyer('aud-mdp-direct');
        const plain = await gotrueUpdateUser(victim.accessToken, { password: `Direct#${randomBytes(6).toString('hex')}A1` });
        console.log(`[AUD-02] PUT /auth/v1/user {password} sans mot de passe actuel : HTTP ${plain.status} ${plain.text.slice(0, 120)}`);
        assert.notEqual(plain.status, 200,
            'GoTrue accepte un nouveau mot de passe sans le mot de passe actuel : la règle de app/api/account/password (current_password) est contournée');
    });

    test('un changement de mot de passe fait avec le seul jeton d’une session prévient toujours le titulaire', async () => {
        const victim = await newBuyer('aud-mdp-alerte');
        const alerts = async () => (await outboxRows({ type: 'PASSWORD_CHANGED', userId: victim.userId })).length;

        // Témoin (précondition) : un changement direct émet bien l'alerte
        const plain = await gotrueUpdateUser(victim.accessToken, { password: `Direct#${randomBytes(6).toString('hex')}A1` });
        const afterPlain = await alerts();
        console.log(`[AUD-02] témoin : PUT {password} HTTP ${plain.status} ; lignes PASSWORD_CHANGED : ${afterPlain}`);
        assert.equal(plain.status, 200, `précondition : changement direct accepté (sinon voir le premier test) : ${plain.text}`);
        assert.ok(afterPlain > 0, 'précondition : le changement direct émet l’alerte PASSWORD_CHANGED');

        // Attaque : marque « compte coquille » posée par l'utilisateur lui-même, puis nouveau mot de passe
        const flag = await gotrueUpdateUser(victim.accessToken, { data: { is_temporary_controller_account: true } });
        const change = await gotrueUpdateUser(victim.accessToken, { password: `Vole#${randomBytes(6).toString('hex')}A1` });
        const afterAttack = await alerts();
        console.log(`[AUD-02] PUT {data:{is_temporary_controller_account:true}} : HTTP ${flag.status} ; PUT {password} : HTTP ${change.status} ; lignes PASSWORD_CHANGED : ${afterPlain} → ${afterAttack}`);
        assert.equal(change.status, 200, `précondition : second changement accepté : ${change.text}`);
        assert.ok(afterAttack > afterPlain,
            `mot de passe changé par PUT /auth/v1/user après la marque is_temporary_controller_account posée par le titulaire de la session : aucune alerte PASSWORD_CHANGED (${afterPlain} → ${afterAttack})`);
    });
});

describe('AUD-03 — compte de l\'inscription publique (sans numéro vérifié) et billets gratuits', () => {
    test('un compte ouvert sans numéro ni code ne prend pas de billets gratuits', async () => {
        const ev = await createSaleEvent('aud-gratuits', [{ name: 'Gratuite', price: 0, total: 3, maxPerOrder: 1 }]);
        const categoryId = ev.categories.Gratuite.id;
        const taken: number[] = [];
        for (let i = 0; i < 3; i += 1) {
            const email = `aud-public-${i}-${randomBytes(5).toString('hex')}@test.eventvillage.local`;
            const client = anon();
            const password = `Public#${randomBytes(6).toString('hex')}A1`;
            const signed = await client.auth.signUp({ email, password });
            assert.equal(signed.error, null, `signUp public ${i} : ${signed.error?.message}`);
            const token = signed.data.session?.access_token
                ?? (await client.auth.signInWithPassword({ email, password })).data.session?.access_token;
            assert.ok(token, `session du compte public ${i}`);
            const { data: row } = await service.from('users').select('status, phone, phone_verified_at').eq('id', signed.data.user!.id).single();
            console.log(`[AUD-03] compte public ${i} : ${JSON.stringify(row)}`);
            const { POST } = await import('../../app/api/tickets/claim-free/route');
            const res = await POST(new NextRequest(`${BASE_URL}/api/tickets/claim-free`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
                body: JSON.stringify({ categoryId, quantity: 1 }),
            }));
            console.log(`[AUD-03] claim-free du compte public ${i} : HTTP ${res.status} ${JSON.stringify(await res.json()).slice(0, 200)}`);
            taken.push(res.status);
        }
        const { data: cat } = await service.from('ticket_categories').select('sold_quantity, total_quantity').eq('id', categoryId).single();
        console.log(`[AUD-03] catégorie gratuite après les trois comptes publics : ${JSON.stringify(cat)}`);
        assert.deepEqual(taken.filter((s) => s === 200), [],
            `des comptes ouverts par l'inscription publique, sans numéro vérifié, ont pris ${taken.filter((s) => s === 200).length} billet(s) gratuit(s) sur 3 (stock épuisé : ${JSON.stringify(cat)})`);
    });
});
