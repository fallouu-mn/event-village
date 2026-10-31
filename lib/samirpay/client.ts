/**
 * Point d'entrée SamirPay pour les services métier.
 *
 * `samirPayClient` délègue chaque appel à la passerelle fournie par le registre
 * d'intégrations : client HTTP réel (lib/samirpay/http-client.ts) en production,
 * faux adaptateur sans réseau en test (EV_INTEGRATIONS=fake).
 */
import { getPaymentGateway } from '@/lib/integrations/registry';
import type { PaymentGateway } from '@/lib/integrations/types';

export { SamirPayHttpClient } from './http-client';

export const samirPayClient: PaymentGateway = {
    initDirectPayment: (payload) => getPaymentGateway().initDirectPayment(payload),
    checkTransactionStatus: (transactionId) => getPaymentGateway().checkTransactionStatus(transactionId),
    getSolde: () => getPaymentGateway().getSolde(),
    sendCashout: (payload) => getPaymentGateway().sendCashout(payload),
};
