/**
 * Lot 9 quinquies (B1 : AUTH-06) — joindre le support.
 *
 * Trois réglages du SUPERADMIN (platform_settings, migration 20261112000003) : support.whatsapp (« Numéro WhatsApp du
 * support »), support.phone (« Téléphone du support »), support.email (« Email du support ») ; chaîne vide = non renseigné.
 * npm run essai:check-reel en exige au moins un avant une séance réelle. Chaque message ou écran qui dit « contactez le
 * support » donne ce contact, ou à défaut le lien de la page publique {lien}/aide (qui l'affiche aussi).
 * Lecture côté serveur seulement (service_role) : les écrans le reçoivent dans la réponse de leur route ou par /aide.
 * Une lecture en échec lève SupportContactUnavailable : jamais un contact inventé.
 */
import { getServerEnv } from '@/lib/env';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const SUPPORT_SETTING_KEYS = ['support.whatsapp', 'support.phone', 'support.email'] as const;
export type SupportSettingKey = typeof SUPPORT_SETTING_KEYS[number];

export const SUPPORT_SETTING_LABELS: Readonly<Record<SupportSettingKey, string>> = {
    'support.whatsapp': 'Numéro WhatsApp du support',
    'support.phone': 'Téléphone du support',
    'support.email': 'Email du support',
};

export interface SupportContact {
    whatsapp: string | null;
    phone: string | null;
    email: string | null;
    /** {NEXT_PUBLIC_APP_URL}/aide */
    helpUrl: string;
}

export class SupportContactUnavailable extends Error {
    constructor(detail: string) {
        super(detail);
        this.name = 'SupportContactUnavailable';
    }
}

export function helpUrl(): string {
    return `${getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')}/aide`;
}

function textValue(value: unknown): string | null {
    const v = (value as { value?: unknown } | null)?.value;
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/** Contact du support lu dans les réglages ; null pour un réglage vide. */
export async function getSupportContact(): Promise<SupportContact> {
    const { data, error } = await getServiceRoleClient().from('platform_settings').select('key, value').in('key', [...SUPPORT_SETTING_KEYS]);
    if (error) throw new SupportContactUnavailable(`réglages du support illisibles : ${error.message}`);
    const byKey = new Map((data ?? []).map((r) => [String(r.key), textValue(r.value)]));
    return {
        whatsapp: byKey.get('support.whatsapp') ?? null,
        phone: byKey.get('support.phone') ?? null,
        email: byKey.get('support.email') ?? null,
        helpUrl: helpUrl(),
    };
}

/** Numéro +221XXXXXXXXX affiché « 77 123 45 67 » ; un autre format est rendu tel quel. */
export function displayPhone(e164: string): string {
    const m = /^\+221(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(e164);
    return m ? `${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}

/** true si au moins un moyen de contact est renseigné. */
export function hasSupportContact(c: SupportContact): boolean {
    return Boolean(c.whatsapp || c.phone || c.email);
}

/**
 * Phrase de contact pour un message d'erreur ou un écran : « Support : WhatsApp 77 123 45 67, téléphone 33 800 00 00,
 * support@exemple.sn. Aide : https://…/aide » ; sans contact renseigné : « Aide et contact : https://…/aide ».
 */
export function supportSentence(c: SupportContact): string {
    const parts: string[] = [];
    if (c.whatsapp) parts.push(`WhatsApp ${displayPhone(c.whatsapp)}`);
    if (c.phone) parts.push(`téléphone ${displayPhone(c.phone)}`);
    if (c.email) parts.push(c.email);
    return parts.length > 0 ? `Support : ${parts.join(', ')}. Aide : ${c.helpUrl}` : `Aide et contact : ${c.helpUrl}`;
}

/**
 * Lot 9 quinquies (A5 : T1) : refus d'un compte suspendu, avant tout SMS et tout lien de session. Le contact est lu dans
 * les réglages ; une lecture en échec donne le lien /aide seul (la page affiche le contact), jamais un contact inventé.
 */
export async function suspendedAccountMessage(): Promise<{ error: string; support: SupportContact | null }> {
    try {
        const contact = await getSupportContact();
        return { error: `Votre compte est suspendu. ${supportSentence(contact)}`, support: contact };
    } catch (err) {
        console.error('[support] contact illisible pour le refus d’un compte suspendu :', err instanceof Error ? err.message : String(err));
        return { error: `Votre compte est suspendu. Aide et contact : ${helpUrl()}`, support: null };
    }
}
