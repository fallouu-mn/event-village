import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRecentPassword } from '@/lib/auth/password-confirm';
import { requireActiveSession, requireVerifiedPhone } from '@/lib/auth/session';
import { normalizeRecipient } from '@/lib/validations/transfer';
import { TicketTransferService, TRANSFER_PHONE, type TransferRefusal } from '@/lib/tickets/ticket-transfer.service';
import { getServerEnv } from '@/lib/env';
import { releaseQuota, reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';

const DAY_SECONDS = 86_400;

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
    recipient: z.string({ required_error: 'Le numéro de téléphone du destinataire est requis.' })
        .trim()
        .min(3, 'Saisissez le numéro de téléphone du destinataire.')
        .max(254, 'Numéro de téléphone du destinataire invalide.'),
}).strict();

/**
 * POST /api/tickets/[id]/transfer — lot 6, contrat B4 avec l'amendement 2 (transfert vers un numéro
 * seulement, sans jeton ni lien) : transfert PENDING, verrou du billet et offre au destinataire (SMS au
 * numéro, cloche et push au compte dont le numéro vérifié est la cible) dans la même transaction (RPC
 * ticket_transfer_initiate). Une adresse email est refusée (400 RECIPIENT_PHONE_REQUIRED). Lot 9 bis (R57) : mot de passe
 * récent exigé (403 PASSWORD_CONFIRMATION_REQUIRED).
 */
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    const activeSession = await requireActiveSession(req);
    if (activeSession.response) return activeSession.response;
    // Lot 9 quater (A2 : AUD-03, G-36) : numéro prouvé par un code SMS exigé avant toute action qui donne quelque chose
    const unverified = requireVerifiedPhone(activeSession.user);
    if (unverified) return unverified;
    const user = activeSession.user;
    // Lot 9 bis (R57, B35) : mot de passe saisi depuis moins de 10 minutes sur cette session, avant tout verrou ou SMS.
    const recent = await requireRecentPassword(req, user.id);
    if (recent) return recent;

    const resolvedParams = await Promise.resolve(context?.params);
    const ticketId = resolvedParams?.id;
    if (!ticketId) {
        return NextResponse.json({ error: 'Identifiant de billet requis.', code: 'TICKET_ID_REQUIRED' }, { status: 400 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corps JSON invalide.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({
            error: parsed.error.errors[0]?.message || 'Numéro de téléphone du destinataire invalide.',
            code: 'INVALID_BODY',
        }, { status: 400 });
    }
    const target = normalizeRecipient(parsed.data.recipient);
    if (target.type === 'EMAIL' || parsed.data.recipient.includes('@')) {
        return NextResponse.json({ error: 'Le billet se transfère vers un numéro de téléphone.', code: 'RECIPIENT_PHONE_REQUIRED' }, { status: 400 });
    }
    if (!TRANSFER_PHONE.test(target.normalized)) {
        return NextResponse.json({ error: 'Numéro de téléphone du destinataire invalide.', code: 'INVALID_BODY' }, { status: 400 });
    }

    // Lot 9 quater (D1 : AUD-18) : transferts offerts au plus TRANSFER_PER_TICKET_DAY fois par billet (3) et
    // TRANSFER_PER_ACCOUNT_DAY fois par compte (10) et par jour ; chaque offre fait partir un SMS indispensable. Une
    // offre refusée par la suite (billet d'un autre, statut) rend ses unités.
    const env = getServerEnv();
    const transferRules = [
        { scope: 'transfer_offer_ticket', bucket: ticketId, windowSecs: DAY_SECONDS },
        { scope: 'transfer_offer_account', bucket: user.id, windowSecs: DAY_SECONDS },
    ];
    const quota = await reserveQuota([
        { ...transferRules[0], max: env.TRANSFER_PER_TICKET_DAY },
        { ...transferRules[1], max: env.TRANSFER_PER_ACCOUNT_DAY },
    ], 'transfert de billet');
    if (!quota.allowed) {
        return quotaRefusalResponse(quota, {
            error: `Limite de transferts atteinte pour aujourd’hui : ${env.TRANSFER_PER_TICKET_DAY} par billet et ${env.TRANSFER_PER_ACCOUNT_DAY} par compte. Réessayez demain.`,
            code: 'TRANSFER_RATE_LIMITED',
        });
    }

    try {
        let result: Awaited<ReturnType<typeof TicketTransferService.initiateTransfer>>;
        try {
            result = await TicketTransferService.initiateTransfer(user.id, ticketId, target.normalized);
        } catch (initErr) {
            const released = await releaseQuota(transferRules, 'transfert de billet (rendu)');
            if (!released.ok) console.error(`[POST /api/tickets/${ticketId}/transfer] unités de quota non rendues`);
            throw initErr;
        }
        const transfer = {
            transfer_id: result.transfer_id,
            ticket_id: result.ticket_id,
            ticket_number: result.ticket_number,
            recipient: result.recipient,
            recipient_type: result.recipient_type,
            expires_at: result.expires_at,
            event_title: result.event_title,
            recipient_notification: result.recipient_notification,
        };
        return NextResponse.json({
            success: true,
            message: `Transfert initié : ${result.recipient} recevra un SMS et devra se connecter avec ce numéro pour accepter le billet sous 48 h.`,
            transfer,
        });
    } catch (err: unknown) {
        const refusal = err as Partial<TransferRefusal>;
        if (typeof refusal?.statusCode === 'number') {
            return NextResponse.json({ error: refusal.message, code: refusal.code ?? 'TRANSFER_REFUSED' }, { status: refusal.statusCode });
        }
        console.error(`[POST /api/tickets/${ticketId}/transfer] erreur :`, err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Transfert momentanément impossible. Réessayez.', code: 'TRANSFER_FAILED' }, { status: 500 });
    }
}
