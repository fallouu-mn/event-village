import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { maskPhone } from '@/lib/payments/payer-phone';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const REFUND_KINDS = ['REFUND', 'EVENT_CANCELLATION_REFUND', 'TICKET_REFUND'];
const TO_RETRY_FILTER = 'status.in.(ECHOUE,INCERTAIN),and(status.eq.A_ENVOYER,blocked_reason.not.is.null)';
const MAX_ITEMS = 100;

/** Motifs de blocage en français : le code de cashouts.blocked_reason ne quitte jamais le serveur. */
const BLOCK_REASON_LABELS: Readonly<Record<string, string>> = {
    OPERATOR_UNKNOWN: 'Opérateur du payeur inconnu',
    PHONE_UNKNOWN: 'Numéro du payeur inconnu',
    NAME_UNKNOWN: 'Prénom ou nom du bénéficiaire manquant',
    SOLDE_INSUFFISANT: 'Solde du compte partenaire SamirPay insuffisant',
    SIMULATED: 'Opération créée en mode simulé : aucun versement',
};
const UNKNOWN_BLOCK_LABEL = 'Blocage à vérifier';

interface CashoutLine {
    id: string;
    kind: string;
    amount: number | string;
    status: 'A_ENVOYER' | 'ECHOUE' | 'INCERTAIN';
    blocked_reason: string | null;
    refund_id: string | null;
    ticket_id: string | null;
    payment_id: string | null;
    phone_number: string | null;
    created_at: string;
}

function rowsOf<T>(what: string, res: { data: unknown; error: { message: string } | null }): T[] {
    if (res.error) throw new Error(`${what} : ${res.error.message}`);
    return (res.data ?? []) as T[];
}

function present(values: Array<string | null>): string[] {
    return Array.from(new Set(values.filter((v): v is string => v !== null)));
}

/**
 * Titre de l'événement de chaque ligne. Le rattachement suit event_cancel : le billet du cashout, sinon
 * payments.event_id, sinon les billets du paiement. Sans aucun des trois (paiement ancien sans billet) : pas de titre.
 */
async function eventTitles(rows: CashoutLine[]): Promise<Map<string, string>> {
    const supabase = getServiceRoleClient();
    const ticketIds = present(rows.map((r) => r.ticket_id));
    const paymentIds = present(rows.map((r) => r.payment_id));

    const eventOfTicket = new Map<string, string>();
    if (ticketIds.length > 0) {
        const tickets = rowsOf<{ id: string; event_id: string }>('billets',
            await supabase.from('tickets').select('id, event_id').in('id', ticketIds));
        for (const t of tickets) eventOfTicket.set(t.id, t.event_id);
    }

    const eventOfPayment = new Map<string, string>();
    if (paymentIds.length > 0) {
        const payments = rowsOf<{ id: string; event_id: string | null }>('paiements',
            await supabase.from('payments').select('id, event_id').in('id', paymentIds));
        for (const p of payments) if (p.event_id) eventOfPayment.set(p.id, p.event_id);
        const withoutEvent = paymentIds.filter((id) => !eventOfPayment.has(id));
        if (withoutEvent.length > 0) {
            const linked = rowsOf<{ payment_id: string; event_id: string }>('billets des paiements',
                await supabase.from('tickets').select('payment_id, event_id').in('payment_id', withoutEvent));
            for (const t of linked) eventOfPayment.set(t.payment_id, t.event_id);
        }
    }

    const eventOf = (r: CashoutLine): string | null =>
        (r.ticket_id ? eventOfTicket.get(r.ticket_id) : undefined) ?? (r.payment_id ? eventOfPayment.get(r.payment_id) : undefined) ?? null;
    const eventIds = present(rows.map(eventOf));
    const titles = new Map<string, string>();
    if (eventIds.length > 0) {
        const events = rowsOf<{ id: string; title: string }>('événements',
            await supabase.from('events').select('id, title').in('id', eventIds));
        for (const e of events) titles.set(e.id, e.title);
    }

    const out = new Map<string, string>();
    for (const r of rows) {
        const eventId = eventOf(r);
        const title = eventId ? titles.get(eventId) : undefined;
        if (title) out.set(r.id, title);
    }
    return out;
}

function stateOf(row: CashoutLine): 'ECHOUE' | 'BLOQUE' | 'INCERTAIN' {
    return row.status === 'A_ENVOYER' ? 'BLOQUE' : row.status;
}

function reasonLabel(row: CashoutLine): string | null {
    if (row.status !== 'A_ENVOYER' || !row.blocked_reason) return null;
    const label = BLOCK_REASON_LABELS[row.blocked_reason];
    if (label) return label;
    console.warn(`[API /api/admin/refunds] motif de blocage sans libellé sur le cashout ${row.id}`);
    return UNKNOWN_BLOCK_LABEL;
}

/** Seul refund_id ouvre la relance : une ligne sans remboursement rattaché n'a rien à relancer. */
function canRetry(row: CashoutLine): boolean {
    if (!row.refund_id) return false;
    return row.status === 'ECHOUE' || (row.status === 'A_ENVOYER' && row.blocked_reason === 'SOLDE_INSUFFISANT');
}

/**
 * GET /api/admin/refunds?state=to_retry — remboursements à reprendre (lot 8, anomalie A3, contrat 3.10), permission
 * refunds.manage. Remboursements ECHOUE, INCERTAIN, ou A_ENVOYER avec blocked_reason, du plus ancien au plus récent,
 * 100 lignes au plus (`truncated`). INCERTAIN n'est jamais relançable : l'argent a pu partir. Le numéro est masqué,
 * last_error reste en base. La relance passe par POST /api/admin/refunds/[id]/retry, avec `refund_id`.
 */
export async function GET(request: NextRequest) {
    const auth = await verifyAdminAuth(request, { requiredPermission: 'refunds.manage' });
    if (!auth.authorized || !auth.user) {
        return auth.errorResponse ?? NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 });
    }

    try {
        if (request.nextUrl.searchParams.get('state') !== 'to_retry') {
            throw new PublicError('Liste de remboursements inconnue.', 'INVALID_STATE', 400);
        }
        const rows = rowsOf<CashoutLine>('cashouts', await getServiceRoleClient()
            .from('cashouts')
            .select('id, kind, amount, status, blocked_reason, refund_id, ticket_id, payment_id, phone_number, created_at')
            .in('kind', REFUND_KINDS)
            .or(TO_RETRY_FILTER)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .limit(MAX_ITEMS + 1));
        const lines = rows.slice(0, MAX_ITEMS);
        const titles = await eventTitles(lines);

        return NextResponse.json({
            items: lines.map((row) => ({
                refund_id: row.refund_id,
                cashout_id: row.id,
                kind: row.kind,
                amount: Number(row.amount),
                state: stateOf(row),
                reason_label: reasonLabel(row),
                event_title: titles.get(row.id) ?? null,
                phone_masked: row.phone_number ? maskPhone(row.phone_number) : null,
                created_at: row.created_at,
                can_retry: canRetry(row),
            })),
            truncated: rows.length > MAX_ITEMS,
        });
    } catch (err) {
        return apiFailure('GET /api/admin/refunds', err, { message: 'Liste des remboursements momentanément indisponible.', code: 'REFUNDS_UNAVAILABLE' });
    }
}
