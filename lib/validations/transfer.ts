import { z } from 'zod';
import { normalizePhoneNumber } from './auth';

/**
 * Schéma de validation pour l'initiation d'un transfert de billet P2P.
 * Accepte soit un numéro de téléphone valide, soit une adresse email valide.
 */
export const InitiateTransferSchema = z.object({
    recipient: z.string({
        required_error: 'Le destinataire (téléphone ou email) est requis.',
    }).min(3, 'Veuillez saisir un numéro de téléphone ou un email valide.').trim(),
}).refine((data) => {
    const val = data.recipient;
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    const cleaned = val.replace(/[\s\-\(\)\.]/g, '');
    const isPhone = /^\+?\d{8,15}$/.test(cleaned);
    return isEmail || isPhone;
}, {
    message: 'Le destinataire doit être un numéro de téléphone valide ou une adresse email valide.',
    path: ['recipient'],
});

export type InitiateTransferInput = z.infer<typeof InitiateTransferSchema>;

/**
 * Normalise l'identifiant du destinataire (E.164 pour les numéros de téléphone, minuscules pour les emails).
 */
export function normalizeRecipient(recipient: string): { normalized: string; type: 'PHONE' | 'EMAIL' } {
    const trimmed = recipient.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return {
            normalized: trimmed.toLowerCase(),
            type: 'EMAIL',
        };
    }
    return {
        normalized: normalizePhoneNumber(trimmed),
        type: 'PHONE',
    };
}
