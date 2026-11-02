/**
 * Faux adaptateur SMS : n'envoie rien, enregistre chaque appel pour assertion.
 *
 * Lot 6 (contrat E6) : chaque enregistrement porte l'issue `outcome` (SENT, REJECTED, UNCERTAIN) et
 * trois scénarios se programment dans une file unique, consommée dans l'ordre d'appel :
 *  - failNext(error)   : refus à réessayer (REJECTED, retryable: true) — comportement historique,
 *                        `success: false` et `error` inchangés ;
 *  - rejectNext(code)  : refus définitif du fournisseur (REJECTED, retryable: false, code MTarget) ;
 *  - uncertainNext(n)  : envoi peut-être parti (délai dépassé après envoi) : le message EST enregistré
 *                        (outcome UNCERTAIN, success: false) et l'adaptateur renvoie UNCERTAIN.
 * `outcome`, `retryable` et `providerCode` s'ajoutent au résultat sans rien retirer : les suites des
 * lots 0 à 5 (success, error, messageId) gardent exactement le même comportement.
 */
import type { SmsAdapter, SmsSendResult } from '../../lib/integrations/types';
import { formatMTargetPhoneNumber } from '../../lib/sms/mtarget-http.adapter';

export type FakeSmsOutcome = 'SENT' | 'REJECTED' | 'UNCERTAIN';

export interface RecordedSms {
    to: string;
    recipient: string;
    message: string;
    success: boolean;
    error?: string;
    /** Lot 6 : issue de l'envoi ; un message compté comme remis a `outcome === 'SENT'`. */
    outcome: FakeSmsOutcome;
    /** Lot 6 : code de refus du fournisseur (rejectNext). */
    providerCode?: string;
    at: string;
}

/**
 * Résultat du faux : `SmsSendResult` plus les champs du contrat E6. Typé localement tant que
 * `lib/integrations/types.ts` ne les déclare pas (le correctif 6.2 les ajoute au contrat).
 */
export type FakeSmsSendResult = SmsSendResult & {
    outcome: FakeSmsOutcome;
    retryable?: boolean;
    providerCode?: string;
};

type Scenario =
    | { kind: 'fail'; error: string }
    | { kind: 'reject'; code: string; error: string }
    | { kind: 'uncertain'; error: string };

export class FakeSmsAdapter implements SmsAdapter {
    readonly sent: RecordedSms[] = [];
    private scenarios: Scenario[] = [];

    /** Fait échouer le prochain envoi (puis les suivants dans l'ordre d'appel) : REJECTED à réessayer. */
    failNext(error = 'SMS refusé (simulation)'): void {
        this.scenarios.push({ kind: 'fail', error });
    }

    /** Lot 6 : refus définitif du fournisseur au prochain envoi (REJECTED, non réessayable). */
    rejectNext(code = '102', error = `Refus définitif du fournisseur (simulation, code ${code})`): void {
        this.scenarios.push({ kind: 'reject', code, error });
    }

    /** Lot 6 : les `n` prochains envois sont peut-être partis (délai dépassé après envoi) : UNCERTAIN. */
    uncertainNext(n = 1, error = 'Délai dépassé après l’envoi de la requête (simulation)'): void {
        for (let i = 0; i < n; i++) this.scenarios.push({ kind: 'uncertain', error });
    }

    /** Nombre de scénarios programmés et pas encore consommés. */
    pendingScenarios(): number {
        return this.scenarios.length;
    }

    reset(): void {
        this.sent.length = 0;
        this.scenarios = [];
    }

    /** Messages reçus par un numéro (comparaison après formatage MTarget), toutes issues confondues. */
    messagesTo(phone: string): RecordedSms[] {
        const recipient = formatMTargetPhoneNumber(phone);
        return this.sent.filter((s) => s.recipient === recipient);
    }

    /** Lot 6 : messages remis à un numéro (`outcome === 'SENT'`). */
    deliveredTo(phone: string): RecordedSms[] {
        return this.messagesTo(phone).filter((s) => s.outcome === 'SENT');
    }

    async sendSms(to: string, message: string): Promise<FakeSmsSendResult> {
        const recipient = formatMTargetPhoneNumber(to);
        const scenario = this.scenarios.shift();
        const at = new Date().toISOString();
        if (scenario === undefined) {
            this.sent.push({ to, recipient, message, success: true, outcome: 'SENT', at });
            const ok: FakeSmsSendResult = { success: true, recipient, messageId: `fake-sms-${this.sent.length}`, outcome: 'SENT' };
            return ok;
        }
        if (scenario.kind === 'fail') {
            this.sent.push({ to, recipient, message, success: false, error: scenario.error, outcome: 'REJECTED', at });
            const failed: FakeSmsSendResult = { success: false, recipient, error: scenario.error, outcome: 'REJECTED', retryable: true };
            return failed;
        }
        if (scenario.kind === 'reject') {
            this.sent.push({ to, recipient, message, success: false, error: scenario.error, outcome: 'REJECTED', providerCode: scenario.code, at });
            const rejected: FakeSmsSendResult = {
                success: false, recipient, error: scenario.error, outcome: 'REJECTED', retryable: false, providerCode: scenario.code,
            };
            return rejected;
        }
        this.sent.push({ to, recipient, message, success: false, error: scenario.error, outcome: 'UNCERTAIN', at });
        const uncertain: FakeSmsSendResult = { success: false, recipient, error: scenario.error, outcome: 'UNCERTAIN' };
        return uncertain;
    }
}
