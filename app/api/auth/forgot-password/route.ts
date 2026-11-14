import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { noStore } from '@/lib/auth/account-sync';
import { sendPasswordResetEmail } from '@/lib/auth/password-reset-email';
import { getClientIp } from '@/lib/security/client-ip';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';

export const dynamic = 'force-dynamic';

const CONTEXT = 'POST /api/auth/forgot-password';

const BodySchema = z.object({
    email: z.string({ required_error: 'Saisissez votre adresse email.' }).trim().toLowerCase()
        .max(254, 'Adresse email trop longue.').email('Adresse email invalide.'),
}).strict();

/** Réponse identique, qu'un compte porte l'adresse ou non (aucune énumération). */
const NEUTRAL = { ok: true, message: 'Si un compte vérifié utilise cette adresse, un lien vient de lui être envoyé. Il est valable 60 minutes.' } as const;

async function handle(req: NextRequest): Promise<NextResponse> {
    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        return NextResponse.json({ error: 'Demande illisible : corps JSON attendu.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Adresse email invalide.', code: 'INVALID_FIELD', field: 'email' }, { status: 400 });
    }
    const email = parsed.data.email;
    // Quotas avant toute lecture : 10 demandes par heure et par IP, 3 par heure et par adresse (empreinte, jamais l'adresse)
    const quota = await reserveQuota([
        { scope: 'password_reset_email_ip', bucket: getClientIp(req) ?? 'unknown', windowSecs: 3600, max: 10 },
        { scope: 'password_reset_email_address', bucket: createHash('sha256').update(email, 'utf8').digest('hex'), windowSecs: 3600, max: 3 },
    ], 'mot de passe oublié par email');
    if (!quota.allowed) {
        return quotaRefusalResponse(quota, { error: 'Trop de demandes de lien. Patientez avant de réessayer.', code: 'RESET_EMAIL_RATE_LIMITED' });
    }
    try {
        const outcome = await sendPasswordResetEmail(email);
        if (outcome === 'NOT_SENT') console.error(`[${CONTEXT}] lien enregistré, email non parti (réponse neutre gardée)`);
    } catch (err) {
        console.error(`[${CONTEXT}]`, err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Envoi momentanément impossible. Réessayez dans un instant.', code: 'RESET_EMAIL_UNAVAILABLE' }, { status: 503 });
    }
    return NextResponse.json(NEUTRAL);
}

/**
 * POST /api/auth/forgot-password — lot 9 quinquies (B2 : AUTH-08, T5). Publique (préfixe /api/auth du middleware).
 * `{ email }` : lien « Mot de passe oublié » envoyé par l'application et Resend à une adresse vérifiée d'un compte ACTIF,
 * à usage unique, 60 minutes. Réponse toujours neutre (200) ; 400 adresse invalide ; 429 ; 503.
 */
export async function POST(req: NextRequest) {
    return noStore(await handle(req));
}
