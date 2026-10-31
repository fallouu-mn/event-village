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
        message: 'L’identifiant de la cible (targetId) doit être un UUID valide.',
    }),
    // Lot 2 : Wave ou Orange Money obligatoire ; carte bancaire retirée tant qu'elle n'est pas intégrée.
    operator: z.enum(['WAVE', 'ORANGE_MONEY'], {
        required_error: 'Choisissez Wave ou Orange Money.',
        invalid_type_error: 'Choisissez Wave ou Orange Money.',
    }),
    // Téléphone du payeur, transmis à SamirPay et persisté (normalisé en 9 chiffres côté serveur).
    payerPhone: z.string().min(9, { message: 'Le numéro du payeur est requis.' }),
    // Billet : quantité bornée par MAX_PER_ORDER_CAP, max_per_order contrôlé en base.
    quantity: z.number().int().min(1).max(50).optional(),
});

export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;

/**
 * Webhook SamirPay (contrat API Partenaires v1.0) : POST application/x-www-form-urlencoded,
 * envoyé seulement en cas de succès, sans signature. Contrôles complets dans
 * lib/payments/webhook.service.ts (jeton du callBackUrl, corrélation, statut SamirPay).
 */
export const SamirPayWebhookSchema = z.object({
    transaction_id: z.string().uuid({ message: 'transaction_id SamirPay invalide.' }),
    order_id: z.string().regex(/^ORD-EV-\d{13}-[0-9A-F]{6,12}$/, { message: 'order_id invalide.' }),
    status: z.literal('success'),
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

