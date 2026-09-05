import { z } from 'zod';

/**
 * Schéma de validation pour la création d'une intention de paiement par la PWA.
 * Note : Le montant (amount) n'est JAMAIS fourni par le client.
 * Il est systématiquement récupéré et vérifié en base PostgreSQL par le backend.
 */
export const CreatePaymentSchema = z.object({
    targetType: z.enum([
        'ORDER',
        'HALL_RESERVATION',
        'TABLE_RESERVATION',
        'TICKET',
        'SUBSCRIPTION',
    ], {
        required_error: 'Le type de cible (targetType) est obligatoire.',
        invalid_type_error: 'Type de paiement non reconnu.',
    }),
    targetId: z.string().uuid({
        message: 'L\'identifiant de la cible (targetId) doit être un UUID valide.',
    }),
    operator: z.enum(['WAVE', 'ORANGE_MONEY', 'CARD'], {
        invalid_type_error: 'Moyen de paiement non reconnu.',
    }).optional(),
    customerPhone: z.string().min(6, {
        message: 'Le numéro de téléphone du client est requis pour le paiement mobile.',
    }).optional(),
    customerName: z.string().optional(),
    customerEmail: z.string().email('Format email invalide').optional(),
    returnUrl: z.string().url('L\'URL de retour doit être valide').optional(),
    cancelUrl: z.string().url('L\'URL d\'annulation doit être valide').optional(),
});

export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;

/**
 * Schéma de validation des données reçues via le Webhook SamirPay.
 * Le webhook est envoyé au format application/x-www-form-urlencoded.
 */
export const SamirPayWebhookSchema = z.object({
    transaction_id: z.string().min(1, {
        message: 'Le transaction_id SamirPay est obligatoire.',
    }),
    order_id: z.string().min(1, {
        message: 'L\'order_id Event Village est obligatoire.',
    }),
    status: z.string().min(1, {
        message: 'Le statut de la transaction est obligatoire.',
    }),
    amount: z.string().optional(),
    currency: z.string().optional(),
    signature: z.string().optional(),
});

export type SamirPayWebhookInput = z.infer<typeof SamirPayWebhookSchema>;

/**
 * Schéma de validation d'une demande de retrait (Cashout) vers Wave / Orange Money.
 * Seuil minimum : 5 000 FCFA conformément au Cahier des Charges V3.0.
 */
export const RequestWithdrawalSchema = z.object({
    amount: z.number({
        required_error: 'Le montant du retrait est requis.',
        invalid_type_error: 'Le montant doit être un nombre.',
    }).min(5000, {
        message: 'Le montant minimum de retrait est de 5 000 FCFA.',
    }),
    operatorName: z.enum(['WAVE', 'ORANGE_MONEY'], {
        required_error: 'L\'opérateur (WAVE ou ORANGE_MONEY) est requis.',
        invalid_type_error: 'Opérateur non supporté (choisir WAVE ou ORANGE_MONEY).',
    }),
    phoneNumber: z.string().min(8, {
        message: 'Le numéro de téléphone du bénéficiaire est requis (au moins 8 chiffres).',
    }),
    firstName: z.string().min(1, {
        message: 'Le prénom du titulaire du compte est requis.',
    }),
    lastName: z.string().min(1, {
        message: 'Le nom du titulaire du compte est requis.',
    }),
    idempotencyKey: z.string().optional(),
});

export type RequestWithdrawalInput = z.infer<typeof RequestWithdrawalSchema>;

