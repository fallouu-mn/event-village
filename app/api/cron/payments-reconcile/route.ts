import { NextRequest, NextResponse } from 'next/server';
import { logAdminAlert } from '@/lib/admin/alerts';
import { getServerEnv } from '@/lib/env';
import { CashoutService } from '@/lib/payments/cashout.service';
import { reconcilePayment, releasePayment, type PaymentRecord, type ReconcileOutcome } from '@/lib/payments/confirmation.service';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { refuseUnlessCron } from '@/lib/security/cron-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Lot 2.9 — réconciliation périodique (obligatoire : le webhook SamirPay n'est envoyé qu'en cas de
 * succès ; FAILED et CANCELLED ne se connaissent que par l'endpoint de statut).
 * Planification proposée : toutes les 5 minutes. Protégée par CRON_SECRET.
 *  1. purge des réservations échues ;
 *  2. paiements PENDING plus anciens que la fenêtre d'attente (PAYMENT_RECONCILE_MIN_AGE_MINUTES) :
 *     statut SamirPay (identifiant enregistré) → RPC de confirmation, échec ou annulation ; au-delà
 *     de PAYMENT_PENDING_MAX_AGE_MINUTES encore PENDING → EXPIRED, réservations rendues ;
 *  3. succès tardifs : paiements EXPIRED ou annulés par le client dans la fenêtre
 *     PAYMENT_LATE_SUCCESS_WINDOW_HOURS (au plus un contrôle toutes les 15 minutes) ;
 *  4. PENDING sans identifiant SamirPay (initialisation interrompue) trop anciens → EXPIRED ;
 *  5. envois d'argent : confirmation des ENVOYE ; envoi réservé puis interrompu → INCERTAIN ;
 *     lot 9 bis (R1, B8) : tout versement resté à envoyer (tous types, blocage SOLDE_INSUFFISANT compris) repris
 *     après 5 minutes (clé cashouts_resumed) ; puis retard de plus de 30 minutes signalé (cashouts_flag_delayed).
 */
async function run(req: NextRequest) {
    const refused = refuseUnlessCron(req);
    if (refused) return refused;
    const env = getServerEnv();
    const supabase = getServiceRoleClient();
    const now = Date.now();
    const summary: Record<string, number> = {};
    const count = (k: string) => { summary[k] = (summary[k] ?? 0) + 1; };

    try {
        const { data: purged, error: purgeErr } = await rpcWithRetry<{ expired: number }>('stock_reservations_expire', {});
        if (purgeErr) throw new Error(`purge des réservations : ${purgeErr.message}`);
        summary.reservations_expired = purged?.expired ?? 0;

        const minAge = new Date(now - env.PAYMENT_RECONCILE_MIN_AGE_MINUTES * 60_000).toISOString();
        const { data: pending, error: pErr } = await supabase.from('payments').select('*')
            .eq('status', 'PENDING').not('external_transaction_id', 'is', null).lt('created_at', minAge)
            .order('created_at', { ascending: true }).limit(env.PAYMENT_RECONCILE_BATCH);
        if (pErr) throw new Error(`lecture des paiements en attente : ${pErr.message}`);
        for (const p of (pending ?? []) as PaymentRecord[]) count(`pending_${(await reconcilePayment(p, 'RECONCILIATION')).toLowerCase()}`);

        const lateFrom = new Date(now - env.PAYMENT_LATE_SUCCESS_WINDOW_HOURS * 3_600_000).toISOString();
        const recheckBefore = now - 15 * 60_000;
        const { data: late, error: lErr } = await supabase.from('payments').select('*')
            .in('status', ['EXPIRED', 'CANCELLED']).eq('provider_final', false).not('external_transaction_id', 'is', null)
            .gt('created_at', lateFrom).order('last_reconciled_at', { ascending: true, nullsFirst: true }).limit(env.PAYMENT_RECONCILE_BATCH);
        if (lErr) throw new Error(`lecture des paiements à surveiller : ${lErr.message}`);
        const due = ((late ?? []) as Array<PaymentRecord & { last_reconciled_at: string | null }>)
            .filter((p) => !p.last_reconciled_at || new Date(p.last_reconciled_at).getTime() < recheckBefore);
        for (const p of due) {
            const outcome: ReconcileOutcome = await reconcilePayment(p, 'RECONCILIATION');
            count(`late_${outcome.toLowerCase()}`);
        }

        const tooOld = new Date(now - env.PAYMENT_PENDING_MAX_AGE_MINUTES * 60_000).toISOString();
        const { data: orphans, error: oErr } = await supabase.from('payments').select('*')
            .eq('status', 'PENDING').is('external_transaction_id', null).lt('created_at', tooOld).limit(env.PAYMENT_RECONCILE_BATCH);
        if (oErr) throw new Error(`lecture des initialisations interrompues : ${oErr.message}`);
        for (const p of (orphans ?? []) as PaymentRecord[]) if (await releasePayment(p, 'EXPIRED', 'INIT_INTERRUPTED')) count('orphan_expired');

        const cash = await CashoutService.confirmSent(env.PAYMENT_RECONCILE_BATCH);
        summary.cashouts_confirmed = cash.confirmed;
        const staleClaim = new Date(now - 5 * 60_000).toISOString();
        const { data: stale, error: sErr } = await supabase.from('cashouts').update({ status: 'INCERTAIN', last_error: 'envoi interrompu (réservation sans réponse enregistrée)', updated_at: new Date().toISOString() })
            .eq('status', 'A_ENVOYER').not('send_started_at', 'is', null).lt('send_started_at', staleClaim).select('id, idempotency_key, amount');
        if (sErr) throw new Error(`envois interrompus : ${sErr.message}`);
        for (const c of stale ?? []) {
            // Lot 6 (J2.2) : l'avis aux administrateurs (ADMIN_CASHOUT_UNCERTAIN) est mis en file par le trigger
            // trg_cashouts_notify dans la transaction de la mise à jour ci-dessus ; ici, le journal d'audit seul.
            const logged = await logAdminAlert({ action: 'CASHOUT_UNCERTAIN', objectType: 'cashouts', objectId: c.id, metadata: { cashout_id: c.id, idempotency_key: c.idempotency_key, amount: c.amount, detail: 'envoi interrompu (réservation sans réponse enregistrée)' } });
            if (!logged) console.error(`[cron payments-reconcile] alerte de l'envoi ${c.idempotency_key} non journalisée`);
        }
        summary.cashouts_interrupted = stale?.length ?? 0;
        const resumed = await CashoutService.resumeUnsent(env.PAYMENT_RECONCILE_BATCH);
        summary.cashouts_resumed = resumed.resumed;
        summary.cashouts_resume_failed = resumed.failed;
        // Lot 9 bis (B1, B11) : retard de plus de 30 minutes signalé une fois ; les avis partent par trg_cashouts_notify.
        const { data: flagged, error: fErr } = await rpcWithRetry<number>('cashouts_flag_delayed', {});
        if (fErr) throw new Error(`versements en retard : ${fErr.message}`);
        summary.cashouts_delayed_flagged = Number(flagged ?? 0);
        return NextResponse.json({ ok: true, ...summary });
    } catch (err) {
        console.error('[cron payments-reconcile] erreur :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ ok: false, error: 'Réconciliation interrompue.', ...summary }, { status: 500 });
    }
}

export const GET = run;
export const POST = run;
