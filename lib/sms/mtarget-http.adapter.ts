/**
 * Adaptateur SMS réel — API REST MTarget (Sénégal & international).
 * Seul endroit du code qui parle au réseau MTarget.
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

export class MTargetHttpAdapter implements SmsAdapter {
    private readonly config: MTargetConfig;

    constructor(config?: MTargetConfig) {
        this.config = config ?? {};
    }

    async sendSms(to: string, message: string): Promise<SmsSendResult> {
        const formattedRecipient = formatMTargetPhoneNumber(to);

        if (!formattedRecipient || formattedRecipient.length < 12) {
            console.error(`[MTargetHttpAdapter] Numéro de destinataire invalide : ${to}`);
            return {
                success: false,
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
            console.warn('[MTargetHttpAdapter] Identifiants MTARGET_USERNAME / MTARGET_PASSWORD manquants dans l\'environnement.');
            return {
                success: false,
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

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const textResponse = await response.text();
            let parsedJson: any = null;
            try {
                parsedJson = JSON.parse(textResponse);
            } catch {
                parsedJson = null; // réponse texte brut ou XML : conservée telle quelle dans rawResponse
            }

            const firstResult = Array.isArray(parsedJson?.results) ? parsedJson.results[0] : null;
            const isMTargetSuccess = response.ok && (!firstResult || firstResult.code === '0' || firstResult.reason === 'ACCEPTED');

            if (!isMTargetSuccess) {
                const errorDetail = firstResult?.reason || `Erreur HTTP MTarget ${response.status}`;
                console.error(`[MTargetHttpAdapter] Erreur HTTP ${response.status}:`, textResponse);
                return {
                    success: false,
                    recipient: formattedRecipient,
                    error: errorDetail,
                    rawResponse: parsedJson || textResponse,
                };
            }

            const ticketId = firstResult?.ticket || parsedJson?.message_id || parsedJson?.id;
            console.log(`[MTargetHttpAdapter] SMS envoyé au ${formattedRecipient} (Ticket: ${ticketId})`);

            return {
                success: true,
                messageId: ticketId,
                recipient: formattedRecipient,
                rawResponse: parsedJson || textResponse,
            };
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : 'Erreur réseau MTarget';
            console.error('[MTargetHttpAdapter] Erreur lors de l\'envoi du SMS:', errorMsg);
            return {
                success: false,
                recipient: formattedRecipient,
                error: errorMsg,
            };
        }
    }
}
