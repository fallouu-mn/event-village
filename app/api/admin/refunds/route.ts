import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { isSimulationRun } from '@/lib/integrations/simulation';
import { cashoutBlockLabel } from '@/lib/payments/cashout.service';
import { maskPhone } from '@/lib/payments/payer-phone';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MAX_ITEMS = 100;

type ResumeState = 'ECHOUE' | 'INCERTAIN' | 'BLOQUE' | 'EN_ATTENTE' | 'ENVOYE_NON_CONFIRME';

/** Ligne de public.cashouts_to_resume() (X1). */
interface ResumeLine {
    id: string;
    kind: string;
    state: ResumeState;
    since: string;
    has_provider_id: boolean;
    simulated: boolean;
}

interface CashoutLine {
    id: string;
    kind: string;
    amount: number | string;
    blocked_reason: string | null;
    send_started_at: string | null;
    ticket_id: string | null;
    payment_id: string | null;
    phone_number: string | null;
    first_name: string | null;
    last_name: string | null;
}

/** Libellés en français : ni le code du type, ni celui de l'état, ni celui du motif ne quittent le serveur. */
const KIND_LABELS: Readonly<Record<string, string>> = {
    REFUND: 'Remboursement d’un paiement',
    EVENT_CANCELLATION_REFUND: 'Remboursement d’une annulation',
    TICKET_REFUND: 'Remboursement d’un billet',
    WITHDRAWAL: 'Retrait',
};
const STATE_LABELS: Readonly<Record<ResumeState, string>> = {
    ECHOUE: 'Refusé par l’opérateur',
    INCERTAIN: 'Issue incertaine',
    BLOQUE: 'Bloqué',
    EN_ATTENTE: 'En attente depuis plus de 30 min',
    ENVOYE_NON_CONFIRME: 'Envoyé, non confirmé',
};
const UNKNOWN_BLOCK_LABEL = 'blocage à vérifier';
/** Motifs sans destination : rien ne peut repartir, seul « Marquer versé » reste (B3). */
const NO_DESTINATION = new Set(['OPERATOR_UNKNOWN', 'PHONE_UNKNOWN']);

function rowsOf<T>(what: string, res: { data: unknown; error: { message: string } | null }): T[] {
    if (res.error) throw new Error(`${what} : ${res.error.message}`);
    return (res.data ?? []) as T[];
}

function present(values: Array<string | null>): string[] {
    return Array.from(new Set(values.filter((v): v is string => v !== null)));
}

/**
 * Titre de l'événement de chaque ligne. Le rattachement suit event_cancel : le billet du cashout, sinon
 * payments.event_id, sinon les billets du paiement. Sans aucun des trois (retrait, paiement ancien sans billet) : pas de titre.
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

function blockLabel(line: ResumeLine, row: CashoutLine): string | null {
    if (line.state !== 'BLOQUE') return null;
    const label = cashoutBlockLabel(row.blocked_reason);
    if (label) return label;
    console.warn(`[API /api/admin/refunds] motif de blocage sans libellé sur le cashout ${row.id}`);
    return UNKNOWN_BLOCK_LABEL;
}

/** Bénéficiaire montré : prénom et initiale du nom, numéro masqué ; jamais le numéro complet. */
function beneficiary(row: CashoutLine): string | null {
    const first = row.first_name?.trim();
    const last = row.last_name?.trim();
    const name = first ? `${first}${last ? ` ${last.charAt(0).toUpperCase()}.` : ''}` : null;
    const phone = row.phone_number ? maskPhone(row.phone_number) : null;
    return [name, phone].filter((x): x is string => Boolean(x)).join(' · ') || null;
}

/**
 * B3 : « Renvoyer » seulement si rien n'est parti. NOW : remboursement refusé (400, aucun débit conservé), blocage
 * levable (solde, limites du compte, nom complété), à envoyer jamais réservé ; AFTER_CHECK : incertain ou envoyé avec
 * identifiant SamirPay, renvoyé seulement si le statut SamirPay dit FAILED ou CANCELLED ; false sinon (B2).
 */
function canResend(line: ResumeLine, row: CashoutLine): 'NOW' | 'AFTER_CHECK' | false {
    switch (line.state) {
        case 'ECHOUE':
            return 'NOW';
        case 'BLOQUE':
            return row.blocked_reason && !NO_DESTINATION.has(row.blocked_reason) && cashoutBlockLabel(row.blocked_reason) !== null && row.blocked_reason !== 'SIMULATED' ? 'NOW' : false;
        case 'EN_ATTENTE':
            return row.send_started_at ? false : 'NOW';
        case 'INCERTAIN':
        case 'ENVOYE_NON_CONFIRME':
            return line.has_provider_id ? 'AFTER_CHECK' : false;
    }
}

function advice(line: ResumeLine, row: CashoutLine): string {
    switch (line.state) {
        case 'ECHOUE':
            return 'Refusé par l’opérateur sans débit : vous pouvez le renvoyer.';
        case 'BLOQUE':
            if (row.blocked_reason && NO_DESTINATION.has(row.blocked_reason)) return 'Aucune destination connue : si le versement a été réglé autrement, marquez-le versé avec sa référence.';
            if (row.blocked_reason === 'NAME_UNKNOWN') return 'Complétez le prénom et le nom du bénéficiaire, puis renvoyez le versement.';
            return 'Rien n’est parti : renvoyez-le une fois la cause levée.';
        case 'EN_ATTENTE':
            return 'Rien n’est parti : il repart seul dès que le solde SamirPay est lisible, ou renvoyez-le.';
        case 'INCERTAIN':
        case 'ENVOYE_NON_CONFIRME':
            return line.has_provider_id
                ? 'Le statut SamirPay est relu avant tout renvoi : renvoyé seulement s’il a échoué.'
                : 'Vérifiez auprès du support SamirPay. Si le versement est parti, marquez-le versé avec sa référence.';
    }
}

/**
 * GET /api/admin/refunds?state=to_retry — « Versements à reprendre » (lot 9 bis, B1, X1, contrat 4.1), permission
 * refunds.manage. Lit public.cashouts_to_resume() (tous types, retraits compris) filtrée par le mode du serveur, du plus
 * ancien au plus récent, 100 lignes au plus ; `total` compte toutes les lignes. Le numéro est masqué, last_error et les
 * codes restent en base. Les décisions passent par POST /api/admin/cashouts/[id]/resend et …/mark-paid (B4).
 */
export async function GET(request: NextRequest) {
    const auth = await verifyAdminAuth(request, { requiredPermission: 'refunds.manage' });
    if (!auth.authorized || !auth.user) {
        return auth.errorResponse ?? NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 });
    }

    try {
        if (request.nextUrl.searchParams.get('state') !== 'to_retry') {
            throw new PublicError('Liste de versements inconnue.', 'INVALID_STATE', 400);
        }
        const supabase = getServiceRoleClient();
        const listed = await supabase.rpc('cashouts_to_resume', {}, { count: 'exact' })
            .eq('simulated', isSimulationRun())
            .order('since', { ascending: true })
            .order('id', { ascending: true })
            .limit(MAX_ITEMS);
        const lines = rowsOf<ResumeLine>('versements à reprendre', listed);
        if (listed.count === null) throw new Error('versements à reprendre : total absent de la réponse');

        const ids = lines.map((l) => l.id);
        const rows = ids.length === 0 ? [] : rowsOf<CashoutLine>('cashouts', await supabase.from('cashouts')
            .select('id, kind, amount, blocked_reason, send_started_at, ticket_id, payment_id, phone_number, first_name, last_name')
            .in('id', ids));
        const byId = new Map(rows.map((r) => [r.id, r]));
        const titles = await eventTitles(rows);

        const items = lines.flatMap((line) => {
            const row = byId.get(line.id);
            if (!row) {
                console.warn(`[API /api/admin/refunds] cashout ${line.id} disparu entre deux lectures`);
                return [];
            }
            return [{
                id: line.id,
                kind: line.kind,
                kind_label: KIND_LABELS[line.kind] ?? 'Versement',
                state: line.state,
                state_label: STATE_LABELS[line.state],
                since: line.since,
                amount: Number(row.amount),
                beneficiary: beneficiary(row),
                event_title: titles.get(row.id) ?? null,
                block_label: blockLabel(line, row),
                can_resend: canResend(line, row),
                can_mark_paid: true,
                advice: advice(line, row),
            }];
        });

        return NextResponse.json({ items, total: listed.count });
    } catch (err) {
        return apiFailure('GET /api/admin/refunds', err, { message: 'Liste des versements à reprendre momentanément indisponible.', code: 'REFUNDS_UNAVAILABLE' });
    }
}
