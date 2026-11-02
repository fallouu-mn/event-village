/**
 * Enregistrement des faux adaptateurs dans le registre d'intégrations.
 * Appelé par tests/helpers/env.ts ; accessible aux tests via getFakes().
 *
 * Lot 6 : faux push (`push`, contrat F4). Tant que `Integrations` (lib/integrations/types.ts) n'a pas
 * de champ `push`, l'objet est typé localement (FakeIntegrations) et transmis tel quel à
 * setIntegrations : le registre le conserve, `getPushAdapter()` le trouvera dès que le correctif 6.2
 * l'ajoute (ce typage local est alors retiré par ce correctif).
 */
import { setIntegrations } from '../../lib/integrations/registry';
import { FakeEmailAdapter } from './fake-email';
import { FakePushAdapter } from './fake-push';
import { FakeSamirPayGateway } from './fake-samirpay';
import { FakeSmsAdapter } from './fake-sms';

export { FakeEmailAdapter } from './fake-email';
export type { RecordedEmail, FakeEmailPayload, FakeEmailSendResult } from './fake-email';
export { FakePushAdapter } from './fake-push';
export type { FakePushResponse, PushAdapter, PushMessage, PushSendOptions, PushSendResult, PushTarget, RecordedPush } from './fake-push';
export { FakeSamirPayGateway } from './fake-samirpay';
export type { FakeInitMode, FakeCashoutMode, FakeWebhook } from './fake-samirpay';
export { FakeSmsAdapter } from './fake-sms';
export type { FakeSmsOutcome, FakeSmsSendResult, RecordedSms } from './fake-sms';

export interface FakeIntegrations {
    sms: FakeSmsAdapter;
    email: FakeEmailAdapter;
    payment: FakeSamirPayGateway;
    /** Lot 6 : push web (contrat F4). */
    push: FakePushAdapter;
}

const fakes: FakeIntegrations = {
    sms: new FakeSmsAdapter(),
    email: new FakeEmailAdapter(),
    payment: new FakeSamirPayGateway(),
    push: new FakePushAdapter(),
};

let installed = false;

export function installFakeIntegrations(): FakeIntegrations {
    if (process.env.EV_INTEGRATIONS !== 'fake') {
        throw new Error(
            `installFakeIntegrations : EV_INTEGRATIONS vaut "${process.env.EV_INTEGRATIONS ?? ''}" au lieu de "fake". ` +
            'Les faux adaptateurs ne s\'installent que dans un environnement de test.'
        );
    }
    // Objet complet (push compris) : le registre garde toutes les clés reçues.
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
    fakes.push.reset();
}
