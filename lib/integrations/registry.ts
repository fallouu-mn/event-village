/**
 * Registre des intégrations externes (SMS, email, push web, paiement).
 *
 * - En production / développement (EV_INTEGRATIONS absent ou "real") : les
 *   adaptateurs HTTP réels sont instanciés paresseusement.
 * - En test (EV_INTEGRATIONS=fake) : AUCUN adaptateur réel n'est jamais créé.
 *   Si les faux adaptateurs n'ont pas été enregistrés via `setIntegrations`,
 *   l'accès échoue explicitement plutôt que de retomber sur le réseau.
 * - En développement (EV_INTEGRATIONS=fake, lot 8) : adaptateurs de console et
 *   passerelle vers le faux service local (./dev-adapters).
 * - EV_INTEGRATIONS=fake est refusé partout ailleurs, NODE_ENV absent compris.
 *   `process.env.NODE_ENV` est lu littéralement : la valeur est figée au build,
 *   et la branche qui charge ./dev-adapters y devient du code mort.
 */
import { ResendHttpAdapter } from '@/lib/email/resend-http.adapter';
import { WebPushAdapter } from '@/lib/push/web-push.adapter';
import { SamirPayHttpClient } from '@/lib/samirpay/http-client';
import { MTargetHttpAdapter } from '@/lib/sms/mtarget-http.adapter';
import type { EmailAdapter, Integrations, PaymentGateway, PushAdapter, SmsAdapter } from './types';

export type IntegrationsMode = 'real' | 'fake';

type DevAdapters = typeof import('./dev-adapters');

let overrides: Partial<Integrations> = {};
let realCache: Partial<Integrations> = {};

export function integrationsMode(): IntegrationsMode {
    const raw = process.env.EV_INTEGRATIONS;
    if (raw === undefined || raw === '' || raw === 'real') return 'real';
    if (raw === 'fake') {
        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') return 'fake';
        throw new Error('EV_INTEGRATIONS=fake est interdit hors développement et test.');
    }
    throw new Error(`EV_INTEGRATIONS invalide : "${raw}" (valeurs admises : real, fake).`);
}

/** Enregistre des adaptateurs (typiquement les faux adaptateurs de test). */
export function setIntegrations(adapters: Partial<Integrations>): void {
    overrides = { ...overrides, ...adapters };
}

/** Retire tous les adaptateurs enregistrés (retour au comportement par défaut). */
export function resetIntegrations(): void {
    overrides = {};
    realCache = {};
}

function missing(name: keyof Integrations): never {
    throw new Error(
        `EV_INTEGRATIONS=fake mais aucun faux adaptateur "${name}" n'est enregistré. ` +
        `Importez tests/helpers/env.ts (qui appelle installFakeIntegrations) avant d'utiliser les services.`
    );
}

/** Adaptateurs de développement (L17) : hors `next dev`, cette branche et le module disparaissent du build. */
function devAdapters(): DevAdapters | null {
    if (process.env.NODE_ENV === 'development') return require('./dev-adapters') as DevAdapters;
    return null;
}

export function getSmsAdapter(): SmsAdapter {
    if (overrides.sms) return overrides.sms;
    if (integrationsMode() === 'fake') {
        const dev = devAdapters();
        if (!dev) return missing('sms');
        if (!realCache.sms) realCache.sms = new dev.DevConsoleSmsAdapter();
        return realCache.sms;
    }
    if (!realCache.sms) realCache.sms = new MTargetHttpAdapter();
    return realCache.sms;
}

export function getEmailAdapter(): EmailAdapter {
    if (overrides.email) return overrides.email;
    if (integrationsMode() === 'fake') {
        const dev = devAdapters();
        if (!dev) return missing('email');
        if (!realCache.email) realCache.email = new dev.DevConsoleEmailAdapter();
        return realCache.email;
    }
    if (!realCache.email) realCache.email = new ResendHttpAdapter();
    return realCache.email;
}

/**
 * Lot 6 (contrat F4) : adaptateur push web. L'adaptateur réel lit sa configuration VAPID à chaque envoi
 * (lib/push/config.ts) ; l'envoyeur ne l'appelle que si le canal est configuré.
 */
export function getPushAdapter(): PushAdapter {
    if (overrides.push) return overrides.push;
    if (integrationsMode() === 'fake') {
        const dev = devAdapters();
        if (!dev) return missing('push');
        if (!realCache.push) realCache.push = new dev.DevConsolePushAdapter();
        return realCache.push;
    }
    if (!realCache.push) realCache.push = new WebPushAdapter();
    return realCache.push;
}

export function getPaymentGateway(): PaymentGateway {
    if (overrides.payment) return overrides.payment;
    if (integrationsMode() === 'fake') {
        const dev = devAdapters();
        if (!dev) return missing('payment');
        if (!realCache.payment) realCache.payment = dev.createDevPaymentGateway();
        return realCache.payment;
    }
    if (!realCache.payment) realCache.payment = new SamirPayHttpClient();
    return realCache.payment;
}
