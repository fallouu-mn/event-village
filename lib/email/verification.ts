/**
 * Lot 9 bis, tâche 48 (R87 ; contrat 4.6 ; décisions B96, B98, B100 ; discovery-9bis-email 2) — lien de vérification
 * d'une adresse email.
 *
 * Modèle « adresse en attente » : l'adresse saisie (inscription, profil, création par un admin) attend dans
 * users.email_pending ; users.email et auth.users gardent l'adresse technique (ou l'adresse déjà vérifiée). Seul ce
 * module envoie un email à une adresse non vérifiée : le lien, synchrone (journal SYNC_LOG EMAIL_VERIFICATION, sans
 * jeton). La validation passe par POST /api/account/email/verify et n'ouvre aucune session.
 *
 * `sendEmailVerification(userId)` :
 *  1. canal email non configuré (sans RESEND_API_KEY) : rien n'est tenté, aucun quota consommé, journal SKIPPED
 *     EMAIL_NOT_CONFIGURED ;
 *  2. jeton de 256 bits (base64url) tiré ici ; seul son SHA-256 part en base (email_verification_issue : adresse
 *     visée, adresse prise ailleurs, quota par compte et par adresse, ancien lien fermé, lien de 24 h) ;
 *  3. rendu du catalogue (renderEmailVerification, textes 11.1 N26) et envoi par EmailService, délai de 5 s ;
 *  4. journal de l'issue (email_verification_log).
 * Lot 9 bis (I1) : hors simulation, un compte de démonstration ne reçoit aucun lien (WITHHELD DEMO_ACCOUNT, journal
 * SKIPPED) ; garde indisponible : WITHHELD DEMO_GUARD_UNAVAILABLE, rien ne part.
 * Une RPC en échec lève (l'appelant répond son statut) ; un envoi refusé ou en panne rend NOT_SENT, journalisé.
 */
import { createHash, randomBytes } from 'node:crypto';
import { EmailService } from '@/lib/email/email.service';
import { getServerEnv } from '@/lib/env';
import { renderEmailVerification } from '@/lib/notifications/catalog';
import { emailChannelAvailable } from '@/lib/notifications/channels';
import { demoBlockedKeys, demoGuardActive } from '@/lib/notifications/demo-guard';
import { getServiceRoleClient } from '@/lib/supabase/server';
import type { EmailSendPayload } from '@/lib/integrations/types';

/** Délai d'un envoi synchrone du lien (l'envoyeur de la boîte d'envoi garde 15 s). */
export const EMAIL_VERIFICATION_TIMEOUT_MS = 5_000;

export type EmailVerificationRefusal = 'NO_EMAIL_TO_VERIFY' | 'EMAIL_TAKEN';

export type EmailVerificationResult =
    | { outcome: 'SENT'; email: string }
    | { outcome: 'NOT_SENT'; email: string }
    | { outcome: 'NOT_CONFIGURED' }
    | { outcome: 'REFUSED'; code: EmailVerificationRefusal }
    | { outcome: 'RATE_LIMITED'; retryAfterSeconds: number }
    /** Lot 9 bis (I1, fix(9b.I1-SG)) : compte de démonstration, ou garde indisponible (échec fermé) ; rien n'est parti. */
    | { outcome: 'WITHHELD'; reason: 'DEMO_ACCOUNT' | 'DEMO_GUARD_UNAVAILABLE' };

/** Valeur `email_verification` des réponses des routes (contrat 4.6). */
export type EmailVerificationState = 'SENT' | 'NOT_SENT' | 'NOT_CONFIGURED';

export function emailVerificationState(result: EmailVerificationResult): EmailVerificationState {
    if (result.outcome === 'SENT') return 'SENT';
    if (result.outcome === 'NOT_CONFIGURED') return 'NOT_CONFIGURED';
    return 'NOT_SENT';
}

/** Hachage du jeton (SHA-256 hexadécimal) : la seule forme connue de la base. */
export function hashVerificationToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

/** Forme d'un jeton reçu (base64url de 32 octets au moins, 256 caractères au plus). */
export function isVerificationToken(value: unknown): value is string {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{43,256}$/.test(value);
}

interface IssueReply {
    ok?: boolean;
    code?: string;
    message?: string;
    verification_id?: string;
    email?: string;
    retry_after_seconds?: number;
}

interface LogReply { ok?: boolean; code?: string; message?: string }

type LogInput =
    | { verification_id: string; outcome: 'SENT' | 'FAILED'; reason?: string; provider_message_id?: string }
    | { user_id: string; outcome: 'SKIPPED'; reason: string };

async function logOutcome(input: LogInput): Promise<LogReply> {
    const { data, error } = await getServiceRoleClient().rpc('email_verification_log', { p: input });
    if (error) throw new Error(`email_verification_log : ${error.code ?? ''} ${error.message}`.trim());
    const reply = (data ?? null) as LogReply | null;
    if (!reply) throw new Error('email_verification_log : réponse vide');
    return reply;
}

/** Journal d'un envoi tenté : son échec est journalisé à son tour, l'issue de l'envoi reste celle rendue. */
async function logAttempt(userId: string, input: Extract<LogInput, { verification_id: string }>): Promise<void> {
    try {
        const reply = await logOutcome(input);
        if (reply.ok !== true) console.error(`[email-verification] journal du lien du compte ${userId} refusé : ${reply.code ?? 'réponse vide'}`);
    } catch (err) {
        console.error(`[email-verification] journal du lien du compte ${userId} non écrit :`, err instanceof Error ? err.message : String(err));
    }
}

/**
 * Envoie un lien de vérification à l'adresse visée du compte (adresse en attente, sinon adresse réelle non vérifiée
 * d'un compte d'avant le lot). Lève si une RPC échoue.
 */
export async function sendEmailVerification(userId: string): Promise<EmailVerificationResult> {
    const supabase = getServiceRoleClient();

    if (!emailChannelAvailable()) {
        const reply = await logOutcome({ user_id: userId, outcome: 'SKIPPED', reason: 'EMAIL_NOT_CONFIGURED' });
        if (reply.ok === true) return { outcome: 'NOT_CONFIGURED' };
        if (reply.code === 'NO_EMAIL_TO_VERIFY') return { outcome: 'REFUSED', code: 'NO_EMAIL_TO_VERIFY' };
        throw new Error(`email_verification_log : ${reply.code ?? 'réponse vide'} ${reply.message ?? ''}`.trim());
    }

    // Lot 9 bis (I1, B108, fix(9b.I1-SG)) : hors simulation, aucun lien vers un compte de démonstration (compte, ou
    // adresse visée d'un tel compte ou du domaine du seed). Vérifié avant l'émission : aucun lien ni quota consommé.
    // Garde indisponible : rien ne part (échec fermé). Journal SKIPPED avec le motif, sans jeton.
    if (demoGuardActive()) {
        const { data: account, error: accountErr } = await supabase.from('users').select('email, email_pending').eq('id', userId).maybeSingle();
        if (accountErr) throw new Error(`lecture du compte ${userId} : ${accountErr.message}`);
        const target = (account?.email_pending as string | null | undefined) ?? (account?.email as string | null | undefined) ?? null;
        const guard = await demoBlockedKeys([{ key: 'account', user_id: userId, email: target }]);
        const withheld = !guard.ok ? 'DEMO_GUARD_UNAVAILABLE' : guard.blocked.has('account') ? 'DEMO_ACCOUNT' : null;
        if (withheld) {
            const reply = await logOutcome({ user_id: userId, outcome: 'SKIPPED', reason: withheld });
            if (reply.code === 'NO_EMAIL_TO_VERIFY') return { outcome: 'REFUSED', code: 'NO_EMAIL_TO_VERIFY' };
            if (reply.ok !== true) throw new Error(`email_verification_log : ${reply.code ?? 'réponse vide'} ${reply.message ?? ''}`.trim());
            console.warn(`[email-verification] lien du compte ${userId} retenu : ${withheld}`);
            return { outcome: 'WITHHELD', reason: withheld };
        }
    }

    const env = getServerEnv();
    const token = randomBytes(32).toString('base64url');
    const { data, error } = await supabase.rpc('email_verification_issue', {
        p: {
            user_id: userId,
            token_hash: hashVerificationToken(token),
            account_max: env.EMAIL_VERIFY_PER_ACCOUNT_HOUR,
            address_max: env.EMAIL_VERIFY_PER_ADDRESS_DAY,
        },
    });
    if (error) throw new Error(`email_verification_issue : ${error.code ?? ''} ${error.message}`.trim());
    const issued = (data ?? null) as IssueReply | null;
    if (!issued) throw new Error('email_verification_issue : réponse vide');
    if (issued.ok !== true) {
        if (issued.code === 'NO_EMAIL_TO_VERIFY' || issued.code === 'EMAIL_TAKEN') return { outcome: 'REFUSED', code: issued.code };
        if (issued.code === 'RATE_LIMITED') return { outcome: 'RATE_LIMITED', retryAfterSeconds: Number(issued.retry_after_seconds ?? 3600) };
        throw new Error(`email_verification_issue : ${issued.code ?? 'réponse vide'} ${issued.message ?? ''}`.trim());
    }
    const verificationId = String(issued.verification_id ?? '');
    const email = String(issued.email ?? '');
    if (!verificationId || !email) throw new Error(`email_verification_issue : réponse incomplète ${JSON.stringify({ ok: issued.ok, code: issued.code })}`);

    const mail = renderEmailVerification(token, { appUrl: env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '') });
    const payload: EmailSendPayload & { timeoutMs: number } = {
        to: email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        idempotencyKey: `EMAIL_VERIFICATION:${verificationId}`,
        timeoutMs: EMAIL_VERIFICATION_TIMEOUT_MS,
    };
    let sent: { sent: boolean; id?: string; error?: string; retryable?: boolean };
    try {
        sent = await EmailService.send(payload);
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.error(`[email-verification] envoi du lien du compte ${userId} interrompu :`, detail);
        await logAttempt(userId, { verification_id: verificationId, outcome: 'FAILED', reason: 'EMAIL_PROVIDER_ERROR' });
        return { outcome: 'NOT_SENT', email };
    }
    if (sent.sent) {
        await logAttempt(userId, { verification_id: verificationId, outcome: 'SENT', ...(sent.id ? { provider_message_id: sent.id } : {}) });
        return { outcome: 'SENT', email };
    }
    console.error(`[email-verification] lien du compte ${userId} non envoyé : ${sent.error ?? 'refus sans détail'}`);
    await logAttempt(userId, {
        verification_id: verificationId,
        outcome: 'FAILED',
        reason: sent.retryable === true ? 'EMAIL_PROVIDER_ERROR' : 'EMAIL_REJECTED',
    });
    return { outcome: 'NOT_SENT', email };
}
