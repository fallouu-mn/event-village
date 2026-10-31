/**
 * Enregistrement des faux adaptateurs dans le registre d'intégrations.
 * Appelé par tests/helpers/env.ts ; accessible aux tests via getFakes().
 */
import { setIntegrations } from '../../lib/integrations/registry';
import { FakeEmailAdapter } from './fake-email';
import { FakeSamirPayGateway } from './fake-samirpay';
import { FakeSmsAdapter } from './fake-sms';

export { FakeEmailAdapter } from './fake-email';
export { FakeSamirPayGateway, computeFakeWebhookSignature } from './fake-samirpay';
export type { FakeInitMode, FakeCashoutMode, FakeTransactionStatus, FakeWebhook, FakeWebhookParams } from './fake-samirpay';
export { FakeSmsAdapter } from './fake-sms';

export interface FakeIntegrations {
    sms: FakeSmsAdapter;
    email: FakeEmailAdapter;
    payment: FakeSamirPayGateway;
}

const fakes: FakeIntegrations = {
    sms: new FakeSmsAdapter(),
    email: new FakeEmailAdapter(),
    payment: new FakeSamirPayGateway(),
};

let installed = false;

export function installFakeIntegrations(): FakeIntegrations {
    if (process.env.EV_INTEGRATIONS !== 'fake') {
        throw new Error(
            `installFakeIntegrations : EV_INTEGRATIONS vaut "${process.env.EV_INTEGRATIONS ?? ''}" au lieu de "fake". ` +
            'Les faux adaptateurs ne s\'installent que dans un environnement de test.'
        );
    }
    setIntegrations(fakes);
    installed = true;
    return fakes;
}

export function getFakes(): FakeIntegrations {
    if (!installed) {
        throw new Error('getFakes : faux adaptateurs non installés (importez tests/helpers/env.ts en premier).');
    }
    return fakes;
}

/** Vide les enregistrements et remet les scénarios par défaut (à appeler dans beforeEach si besoin). */
export function resetFakes(): void {
    fakes.sms.reset();
    fakes.email.reset();
    fakes.payment.reset();
}
