/**
 * Adaptateur SMS réel — API REST MTarget (Sénégal & international).
 * Seul endroit du code qui parle au réseau MTarget.
 *
 * Lot 6 (contrat E6) : délai maximal MTARGET_TIMEOUT_MS (défaut 15 000 ms, lu à chaque appel) et issue
 * explicite `outcome` :
 *  - SENT : 2xx et results[0].code === '0' (ou reason ACCEPTED), identifiant = ticket ;
 *  - REJECTED : refus certain, rien n'est parti (code MTarget de refus, HTTP 4xx) ; `retryable` pour
 *    HTTP 429 et 5xx, connexion refusée ou DNS (la requête n'a pas atteint le fournisseur) ;
 *  - UNCERTAIN : la requête est partie mais l'issue est inconnue (délai dépassé, connexion coupée,
 *    réponse 2xx illisible). Un SMS incertain n'est jamais renvoyé automatiquement.
 * Le texte du message n'est jamais journalisé (il peut porter un code à usage unique).
 */
import type { SmsAdapter, SmsSendResult } from '@/lib/integrations/types';

export interface MTargetConfig {
    username?: string;
    password?: string;
    serviceId?: string;
    sender?: string;
    apiUrl?: string;
}

/**
 * Nettoie et formate strictement un numéro de téléphone pour l'API MTarget.
 * Règle MTarget Sénégal : format international commençant obligatoirement par 00221.
 * Exemples :
 * - "77 123 45 67"      -> "00221771234567"
 * - "+221 77 123 45 67" -> "00221771234567"
 * - "221771234567"      -> "00221771234567"
 * - "00221771234567"    -> "00221771234567"
 */
export function formatMTargetPhoneNumber(phone: string): string {
    if (!phone) return '';
    const digitsOnly = phone.replace(/\D/g, '');

    if (phone.trim().startsWith('00221') || digitsOnly.startsWith('00221')) {
        return `00221${digitsOnly.replace(/^00221/, '')}`;
    }

    if (digitsOnly.startsWith('221') && digitsOnly.length === 12) {
        return `00${digitsOnly}`;
    }

    if (/^[7][05678]\d{7}$/.test(digitsOnly)) {
        return `00221${digitsOnly}`;
    }

    if (digitsOnly.length > 9) {
        return `00${digitsOnly}`;
    }

    return `00221${digitsOnly}`;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/** Erreurs réseau survenues avant que la requête n'atteigne le fournisseur : rien n'est parti. */
const NOT_SENT_CODES = ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'];

export type MTargetOutcome = 'SENT' | 'REJECTED' | 'UNCERTAIN';

/**
 * Résultat de l'adaptateur : `SmsSendResult` plus les champs du contrat E6. `success` vaut
 * `outcome === 'SENT'`. `providerCode` : code de refus MTarget ; `uncertainty` : nature d'une issue
 * incertaine (motif de la boîte d'envoi : PROVIDER_TIMEOUT ou PROVIDER_UNREADABLE).
 */
export type MTargetSmsResult = SmsSendResult & {
    outcome: MTargetOutcome;
    retryable?: boolean;
    providerCode?: string;
    uncertainty?: 'PROVIDER_TIMEOUT' | 'PROVIDER_UNREADABLE';
};

function timeoutMs(): number {
    const raw = Number(process.env.MTARGET_TIMEOUT_MS);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_TIMEOUT_MS;
}

/** Code d'erreur système d'un échec de fetch (undici : `cause.code`, parfois imbriqué). */
function networkCode(err: unknown): string | undefined {
    let cur: unknown = err;
    for (let depth = 0; depth < 4 && cur !== null && typeof cur === 'object'; depth++) {
        const code = (cur as { code?: unknown }).code;
        if (typeof code === 'string') return code;
        cur = (cur as { cause?: unknown }).cause;
    }
    return undefined;
}

function isTimeout(err: unknown): boolean {
    const name = err !== null && typeof err === 'object' ? (err as { name?: unknown }).name : undefined;
    return name === 'TimeoutError' || name === 'AbortError';
}

interface MTargetResultLine { code?: unknown; reason?: unknown; ticket?: unknown }

function firstResult(parsed: unknown): MTargetResultLine | null {
    if (parsed === null || typeof parsed !== 'object') return null;
    const results = (parsed as { results?: unknown }).results;
    if (!Array.isArray(results) || results.length === 0) return null;
    const first: unknown = results[0];
    return first !== null && typeof first === 'object' ? (first as MTargetResultLine) : null;
}

export class MTargetHttpAdapter implements SmsAdapter {
    private readonly config: MTargetConfig;

    constructor(config?: MTargetConfig) {
        this.config = config ?? {};
    }

    async sendSms(to: string, message: string): Promise<MTargetSmsResult> {
        const formattedRecipient = formatMTargetPhoneNumber(to);

        if (!formattedRecipient || formattedRecipient.length < 12) {
            console.error('[MTargetHttpAdapter] Numéro de destinataire invalide : aucun SMS envoyé.');
            return {
                success: false,
                outcome: 'REJECTED',
                retryable: false,
                recipient: formattedRecipient || to,
                error: 'Numéro de destinataire invalide.',
            };
        }

        const username = this.config.username || process.env.MTARGET_USERNAME || '';
        const password = this.config.password || process.env.MTARGET_PASSWORD || '';
        const serviceId = this.config.serviceId || process.env.MTARGET_SERVICE_ID || '36233';
        const sender = this.config.sender || process.env.MTARGET_SENDER || 'EV-Village';
        const apiUrl = this.config.apiUrl || process.env.MTARGET_API_URL || 'https://api-public-2.mtarget.fr/messages';

        if (!username || !password) {
            console.error('[MTargetHttpAdapter] Identifiants MTARGET_USERNAME / MTARGET_PASSWORD manquants : aucun SMS envoyé.');
            return {
                success: false,
                outcome: 'REJECTED',
                retryable: true,
                recipient: formattedRecipient,
                error: 'Configuration MTarget incomplète sur le serveur.',
            };
        }

        const payload = {
            username,
            password,
            service: serviceId,
            sender,
            msisdn: formattedRecipient,
            msg: message,
        };

        let response: Response;
        try {
            response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(timeoutMs()),
            });
        } catch (error: unknown) {
            const code = networkCode(error);
            if (!isTimeout(error) && code !== undefined && NOT_SENT_CODES.includes(code)) {
                console.error(`[MTargetHttpAdapter] Fournisseur injoignable (${code}) : aucun SMS parti.`);
                return {
                    success: false,
                    outcome: 'REJECTED',
                    retryable: true,
                    recipient: formattedRecipient,
                    error: `Fournisseur SMS injoignable (${code}).`,
                };
            }
            const why = isTimeout(error) ? 'délai dépassé' : `connexion interrompue${code ? ` (${code})` : ''}`;
            console.error(`[MTargetHttpAdapter] Issue incertaine après l'envoi de la requête : ${why}.`);
            return {
                success: false,
                outcome: 'UNCERTAIN',
                uncertainty: 'PROVIDER_TIMEOUT',
                recipient: formattedRecipient,
                error: `Issue de l'envoi incertaine : ${why}.`,
            };
        }

        let textResponse: string;
        try {
            textResponse = await response.text();
        } catch (error: unknown) {
            const timedOut = isTimeout(error);
            const why = timedOut ? 'délai dépassé pendant la lecture de la réponse' : 'réponse interrompue';
            console.error(`[MTargetHttpAdapter] Issue incertaine (HTTP ${response.status}) : ${why}.`);
            return {
                success: false,
                outcome: 'UNCERTAIN',
                uncertainty: timedOut ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNREADABLE',
                recipient: formattedRecipient,
                error: `Issue de l'envoi incertaine : ${why}.`,
            };
        }

        if (response.status === 429 || response.status >= 500) {
            console.error(`[MTargetHttpAdapter] Refus temporaire du fournisseur : HTTP ${response.status}.`);
            return {
                success: false,
                outcome: 'REJECTED',
                retryable: true,
                recipient: formattedRecipient,
                error: `Fournisseur SMS indisponible (HTTP ${response.status}).`,
                rawResponse: textResponse,
            };
        }
        if (!response.ok) {
            console.error(`[MTargetHttpAdapter] Requête refusée par le fournisseur : HTTP ${response.status}.`);
            return {
                success: false,
                outcome: 'REJECTED',
                retryable: false,
                recipient: formattedRecipient,
                error: `Requête refusée par le fournisseur SMS (HTTP ${response.status}).`,
                rawResponse: textResponse,
            };
        }

        let parsed: unknown = null;
        try {
            parsed = JSON.parse(textResponse);
        } catch {
            parsed = null; // réponse texte ou XML : traitée ci-dessous comme illisible (issue incertaine)
        }
        const first = firstResult(parsed);
        if (!first) {
            console.error(`[MTargetHttpAdapter] Réponse ${response.status} illisible : issue incertaine.`);
            return {
                success: false,
                outcome: 'UNCERTAIN',
                uncertainty: 'PROVIDER_UNREADABLE',
                recipient: formattedRecipient,
                error: 'Réponse du fournisseur SMS illisible : issue incertaine.',
                rawResponse: parsed ?? textResponse,
            };
        }

        const providerCode = first.code === undefined || first.code === null ? undefined : String(first.code);
        if (providerCode === '0' || first.reason === 'ACCEPTED') {
            return {
                success: true,
                outcome: 'SENT',
                messageId: first.ticket === undefined || first.ticket === null ? undefined : String(first.ticket),
                recipient: formattedRecipient,
                rawResponse: parsed,
            };
        }

        const reason = typeof first.reason === 'string' ? first.reason : 'refus du fournisseur';
        console.error(`[MTargetHttpAdapter] SMS refusé par MTarget (code ${providerCode ?? 'inconnu'}, ${reason}).`);
        return {
            success: false,
            outcome: 'REJECTED',
            retryable: false,
            providerCode,
            recipient: formattedRecipient,
            error: `SMS refusé par le fournisseur (code ${providerCode ?? 'inconnu'} : ${reason}).`,
            rawResponse: parsed,
        };
    }
}
