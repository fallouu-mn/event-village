import { NextRequest } from 'next/server';
import { handleSamirPayWebhook } from '@/lib/payments/webhook.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/samirpay?t=<jeton du paiement> — notification SamirPay (form-urlencoded).
 * Contrôles et journal : lib/payments/webhook.service.ts.
 */
export async function POST(req: NextRequest) {
    return handleSamirPayWebhook(req);
}
