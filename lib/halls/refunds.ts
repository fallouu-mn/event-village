import { CashoutService } from '@/lib/payments/cashout.service';

/**
 * Lot 10a — envoi immédiat des remboursements créés par une annulation ou un délai dépassé (Wave, Orange Money, chemin
 * des billets). Un envoi en échec n'arrête rien : il est repris par la tâche des versements (cashouts_to_resume).
 */
export async function sendHallRefunds(ids: unknown): Promise<void> {
    if (!Array.isArray(ids)) return;
    for (const id of ids) {
        try {
            await CashoutService.send(String(id));
        } catch (err) {
            console.error(`[salles] envoi du remboursement ${String(id)} en échec :`, err instanceof Error ? err.message : String(err));
        }
    }
}
