/**
 * Lot 9 quinquies (A7 : AUTH-11) — règle du mot de passe côté serveur : règle commune (lib/auth/password-rules.ts) PLUS
 * refus des mots de passe courants (liste SecLists de 10 000 entrées et mots sénégalais évidents,
 * lib/auth/common-passwords.data.ts). SERVEUR SEULEMENT.
 *
 * Un mot de passe est « courant » si, en minuscules et sans accent :
 *  - il figure tel quel dans la liste ; ou
 *  - son cœur (chiffres, signes et espaces retirés au début et à la fin, espaces intérieurs retirés) y figure :
 *    « Sunshine2026! », « 123password!! » sont refusés comme « sunshine » et « password ».
 * Appliqué à toute pose d'un nouveau mot de passe (inscription, inscription partenaire, changement, récupération,
 * activation) ; jamais à la connexion.
 */
import { z } from 'zod';
import { COMMON_PASSWORDS_10K, SENEGAL_EXTRA } from './common-passwords.data';
import {
    normalizePassword, passwordRuleMessage, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_TOO_COMMON, PASSWORD_TOO_LONG, PASSWORD_TOO_SHORT,
} from './password-rules';

let commonSet: Set<string> | null = null;

function common(): Set<string> {
    if (!commonSet) {
        commonSet = new Set<string>();
        for (const w of COMMON_PASSWORDS_10K.split('\n')) if (w) commonSet.add(normalizePassword(w));
        for (const w of SENEGAL_EXTRA) commonSet.add(normalizePassword(w));
    }
    return commonSet;
}

/** Nombre d'entrées de la liste (contrôle des tests). */
export function commonPasswordCount(): number {
    return common().size;
}

/** Vrai si le mot de passe, ou son cœur, figure dans la liste des mots de passe courants. */
export function isCommonPassword(password: string): boolean {
    const norm = normalizePassword(password);
    const set = common();
    if (set.has(norm)) return true;
    const core = norm.replace(/^[^a-z]+|[^a-z]+$/g, '').replace(/\s+/g, '');
    return core.length > 0 && set.has(core);
}

/** Message de refus complet (règle commune puis liste), ou null. */
export function serverPasswordRuleMessage(password: string): string | null {
    return passwordRuleMessage(password) ?? (isCommonPassword(password) ? PASSWORD_TOO_COMMON : null);
}

/** Schéma serveur : longueur, mots évidents, liste des mots de passe courants. */
export const ServerPasswordSchema = z.string()
    .min(PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT)
    .max(PASSWORD_MAX_LENGTH, PASSWORD_TOO_LONG)
    .superRefine((value, ctx) => {
        if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) return;
        const message = serverPasswordRuleMessage(value);
        if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    });
