/**
 * Audit de sécurité du module événements — AUD-19 : GoTrue envoie un code de connexion par email à l'adresse technique
 * de tout compte inscrit par son numéro.
 *
 * L'identifiant GoTrue d'un compte inscrit par l'application est `<numéro sans +>@eventvillage.sn`
 * (lib/auth/account-sync.ts:16-17, app/api/auth/register/route.ts:166-177, email confirmé d'office), donc déductible
 * du numéro. Le fournisseur email de GoTrue est actif (supabase/config.toml [auth.email], otp_length = 6,
 * otp_expiry = 3600 ; docs/deploiement-projet-neuf.md:22 « email : activé »). Avec la clé anon publique,
 * POST /auth/v1/otp (ou /auth/v1/recover) fait partir vers cette adresse un code à 6 chiffres valable une heure, qui
 * ouvre une session par POST /auth/v1/verify. L'application ne s'en sert jamais pour ces comptes. Quiconque lit la
 * boîte du domaine (adresse « attrape-tout », prestataire de messagerie, employé) ou devine le code (seule limite :
 * token_verifications par IP, 30 par 5 minutes en local) prend le compte, puis le garde par AUD-02.
 *
 * Test ROUGE tant que la faille existe : GoTrue refuse d'émettre un code de connexion pour l'adresse technique d'un
 * compte. À titre d'illustration seulement (non affirmé), la suite lit le code dans le serveur de courrier local de la
 * CI et dit si la session s'ouvre.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { registerClientFlow } from '../parcours/terrain-helpers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const MAIL_API = 'http://127.0.0.1:54324/api/v1';

async function gotrue(path: string, body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
        method: 'POST', headers: { apikey: ANON_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try { json = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { json = { brut: text.slice(0, 200) }; }
    return { status: res.status, json };
}

/** Illustration : dernier code à 6 chiffres reçu par `address` dans le serveur de courrier local (Mailpit), ou la raison de l'échec. */
async function lastMailedCode(address: string): Promise<{ code: string | null; note: string }> {
    try {
        const list = await fetch(`${MAIL_API}/messages?limit=50`);
        if (!list.ok) return { code: null, note: `serveur de courrier : HTTP ${list.status}` };
        const data = await list.json() as { messages?: Array<{ ID: string; To?: Array<{ Address: string }> }> };
        const msg = (data.messages ?? []).find((m) => (m.To ?? []).some((t) => t.Address.toLowerCase() === address.toLowerCase()));
        if (!msg) return { code: null, note: 'aucun message pour cette adresse' };
        const full = await (await fetch(`${MAIL_API}/message/${msg.ID}`)).json() as { Text?: string; HTML?: string };
        const code = `${full.Text ?? ''} ${full.HTML ?? ''}`.match(/\b(\d{6})\b/)?.[1] ?? null;
        return { code, note: code ? 'code lu dans le message' : 'message sans code à 6 chiffres' };
    } catch (err) {
        return { code: null, note: `serveur de courrier injoignable : ${err instanceof Error ? err.message : String(err)}` };
    }
}

describe('AUD-19 — code de connexion GoTrue envoyé à l\'adresse technique d\'un compte inscrit par son numéro', () => {
    test('GoTrue n\'émet aucun code de connexion pour l\'adresse technique <numéro>@eventvillage.sn', async () => {
        const flow = await registerClientFlow({}, { expectOk: true });
        assert.ok(flow.userId, 'précondition : compte inscrit par le parcours de l\'application');
        const technical = `${flow.phone.replace('+', '')}@eventvillage.sn`;

        const otp = await gotrue('otp', { email: technical, create_user: false });
        console.log(`[AUD-19] POST /auth/v1/otp {email: ${technical}, create_user: false} (clé anon seule) : HTTP ${otp.status} ${JSON.stringify(otp.json).slice(0, 200)}`);

        if (otp.status === 200) {
            const mailed = await lastMailedCode(technical);
            let session = 'non essayée';
            if (mailed.code) {
                const verify = await gotrue('verify', { type: 'email', email: technical, token: mailed.code });
                const uid = (verify.json.user as { id?: string } | undefined)?.id;
                session = verify.status === 200 && verify.json.access_token
                    ? `ouverte pour le compte ${uid === flow.userId ? 'de la victime' : uid}` : `refusée (HTTP ${verify.status})`;
            }
            console.log(`[AUD-19] illustration (lecture de la boîte du domaine) : ${mailed.note} ; session : ${session}`);
        }
        assert.notEqual(otp.status, 200,
            `GoTrue a émis un code de connexion par email pour ${technical}, adresse technique déductible du numéro du compte`);
    });
});
