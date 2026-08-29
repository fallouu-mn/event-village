export interface MTargetSendResult {
    success: boolean;
    messageId?: string;
    recipient: string;
    error?: string;
    rawResponse?: unknown;
}

export interface MTargetConfig {
    username?: string;
    password?: string;
    serviceId?: string;
    sender?: string;
    apiUrl?: string;
}

/**
 * Nettoie et formate strictement un numéro de téléphone pour l'API MTarget.
 * Règle MTarget Sénégal : Format international commençant obligatoirement par 00221.
 * Exemples :
 * - "77 123 45 67"     -> "00221771234567"
 * - "+221 77 123 45 67" -> "00221771234567"
 * - "221771234567"     -> "00221771234567"
 * - "00221771234567"   -> "00221771234567"
 */
export function formatMTargetPhoneNumber(phone: string): string {
    if (!phone) return '';
    // Nettoyer tous les caractères non numériques (espaces, tirets, +, parenthèses, points)
    const digitsOnly = phone.replace(/\D/g, '');

    // 1. Déjà au format 00221...
    if (phone.trim().startsWith('00221') || digitsOnly.startsWith('00221')) {
        return `00221${digitsOnly.replace(/^00221/, '')}`;
    }

    // 2. Format international avec 221 au début (ex: +221771234567 ou 221771234567)
    if (digitsOnly.startsWith('221') && digitsOnly.length === 12) {
        return `00${digitsOnly}`;
    }

    // 3. Format local sénégalais à 9 chiffres (ex: 77 123 45 67 ou 70, 75, 76, 78)
    if (/^[7][05678]\d{7}$/.test(digitsOnly)) {
        return `00221${digitsOnly}`;
    }

    // Fallback : si commence par un indicatif quelconque
    if (digitsOnly.length > 9) {
        return `00${digitsOnly}`;
    }

    return `00221${digitsOnly}`;
}

export class MTargetService {
    private readonly username: string;
    private readonly password: string;
    private readonly serviceId: string;
    private readonly sender: string;
    private readonly apiUrl: string;

    constructor(config?: MTargetConfig) {
        this.username = config?.username || process.env.MTARGET_USERNAME || '';
        this.password = config?.password || process.env.MTARGET_PASSWORD || '';
        this.serviceId = config?.serviceId || process.env.MTARGET_SERVICE_ID || '36233';
        this.sender = config?.sender || process.env.MTARGET_SENDER || 'EasyArena';
        this.apiUrl = config?.apiUrl || process.env.MTARGET_API_URL || 'https://api-public-2.mtarget.fr/messages';
    }

    /**
     * Envoie un SMS générique via l'API REST MTarget
     */
    async sendSms(to: string, message: string): Promise<MTargetSendResult> {
        const formattedRecipient = formatMTargetPhoneNumber(to);

        if (!formattedRecipient || formattedRecipient.length < 12) {
            console.error(`[MTargetService] Numéro de destinataire invalide : ${to}`);
            return {
                success: false,
                recipient: formattedRecipient || to,
                error: 'Numéro de destinataire invalide.',
            };
        }

        const effectiveUsername = this.username || process.env.MTARGET_USERNAME || '';
        const effectivePassword = this.password || process.env.MTARGET_PASSWORD || '';
        const effectiveService = this.serviceId || process.env.MTARGET_SERVICE_ID || '36233';
        const effectiveSender = this.sender || process.env.MTARGET_SENDER || 'EV-Village';
        const effectiveUrl = this.apiUrl || process.env.MTARGET_API_URL || 'https://api-public-2.mtarget.fr/messages';

        if (!effectiveUsername || !effectivePassword) {
            console.warn('[MTargetService] Identifiants MTARGET_USERNAME / MTARGET_PASSWORD manquants dans l\'environnement.');
            return {
                success: false,
                recipient: formattedRecipient,
                error: 'Configuration MTarget incomplète sur le serveur.',
            };
        }

        const payload = {
            username: effectiveUsername,
            password: effectivePassword,
            service: effectiveService,
            sender: effectiveSender,
            msisdn: formattedRecipient,
            msg: message,
        };

        try {
            const response = await fetch(effectiveUrl, {
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
                // Si l'API renvoie du texte brut ou du XML
            }

            const firstResult = Array.isArray(parsedJson?.results) ? parsedJson.results[0] : null;
            const isMTargetSuccess = response.ok && (!firstResult || firstResult.code === '0' || firstResult.reason === 'ACCEPTED');

            if (!isMTargetSuccess) {
                const errorDetail = firstResult?.reason || `Erreur HTTP MTarget ${response.status}`;
                console.error(`[MTargetService] Erreur HTTP ${response.status}:`, textResponse);
                return {
                    success: false,
                    recipient: formattedRecipient,
                    error: errorDetail,
                    rawResponse: parsedJson || textResponse,
                };
            }

            const ticketId = firstResult?.ticket || parsedJson?.message_id || parsedJson?.id;
            console.log(`[MTargetService] SMS envoyé avec succès au ${formattedRecipient} (Ticket: ${ticketId})`);

            // MTarget valide avec succès
            return {
                success: true,
                messageId: ticketId,
                recipient: formattedRecipient,
                rawResponse: parsedJson || textResponse,
            };
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : 'Erreur réseau MTarget';
            console.error('[MTargetService] Erreur lors de l\'envoi du SMS:', errorMsg);
            return {
                success: false,
                recipient: formattedRecipient,
                error: errorMsg,
            };
        }
    }

    /**
     * Envoi spécifique d'un code OTP (utilisé par le Hook Supabase Auth)
     */
    async sendOtp(phone: string, otpCode: string): Promise<MTargetSendResult> {
        const message = `Votre code de vérification Event Village est : ${otpCode}. Valable 10 minutes.`;
        return this.sendSms(phone, message);
    }

    /**
     * Envoi de notification métier (ex: confirmation d'achat de ticket, validation de réservation)
     */
    async sendNotification(phone: string, message: string): Promise<MTargetSendResult> {
        return this.sendSms(phone, message);
    }
}

// Singleton par défaut pour l'application
export const mTargetService = new MTargetService();
